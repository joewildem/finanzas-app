-- Módulo Inversiones (CU-049 a CU-054) — docs/pdr/inversiones.md, docs/pdr/data-model-registry.md
--
-- A diferencia de todos los módulos anteriores, Inversiones no mueve dinero: `balance_actual` es un
-- dato capturado a mano (RN-143), no derivado de `transactions`. Introduce `investments` (los
-- instrumentos) e `investment_balance_history` (una fila por instrumento y fecha, sin pantalla
-- propia, insumo del futuro Dashboard + Reportes). No se agrega `budgets.investment_id` ni
-- `transactions.investment_id` — decisión documentada explícitamente en el propio módulo.

-- ---------------------------------------------------------------------------
-- 1. investments
-- ---------------------------------------------------------------------------

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ticker text not null,
  nombre text not null,
  grupo_activo text not null,
  tipo_activo text not null,
  porcentaje_objetivo numeric(5,2) not null default 0,
  balance_actual numeric(14,2) not null default 0,
  status text not null default 'inactivo' check (status in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investments_ticker_length check (char_length(ticker) between 1 and 20),
  constraint investments_nombre_length check (char_length(nombre) between 2 and 120),
  -- RN-142: catálogos cerrados a nivel de esquema, no administrables por el usuario en esta versión.
  constraint investments_grupo_activo_valid check (grupo_activo in (
    'Large Cap', 'Small Cap', 'REIT', 'Developed Markets', 'Emerging Markets',
    'Treasury Bonds', 'Crypto', 'Retirement'
  )),
  constraint investments_tipo_activo_valid check (tipo_activo in (
    'Stock', 'ETF', 'Bond', 'Fund', 'Crypto', 'Real Estate', 'PPR'
  )),
  constraint investments_porcentaje_objetivo_range check (porcentaje_objetivo between 0 and 100),
  constraint investments_balance_actual_non_negative check (balance_actual >= 0),
  -- RN-161: un instrumento activo debe tener porcentaje objetivo mayor a cero. La invariante de
  -- conjunto (RN-159, suma de activos = 100%) solo puede vivir en save_portfolio_config — no es
  -- expresable como CHECK de una sola fila.
  constraint investments_active_requires_percent check (status <> 'activo' or porcentaje_objetivo > 0)
);

-- RN-140: ticker único entre TODOS los instrumentos del usuario, sin importar status — a diferencia
-- de savings_goals.nombre (único solo entre metas activas), un instrumento inactivo sigue
-- conservando capital real.
create unique index investments_user_ticker_key on public.investments (user_id, ticker);
create index investments_user_status_idx on public.investments (user_id, status);

create trigger investments_set_updated_at
before update on public.investments
for each row execute function public.set_updated_at();

alter table public.investments enable row level security;

create policy "investments_select_own" on public.investments for select to authenticated
  using (auth.uid() = user_id);
create policy "investments_insert_own" on public.investments for insert to authenticated
  with check (auth.uid() = user_id);
create policy "investments_update_own" on public.investments for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- RN-179: a diferencia de accounts/categories/savings_goals (sin política de delete — solo baja
-- lógica), aquí SÍ existe eliminación física (CU-047), pero acotada a instrumentos inactivos. La
-- política de RLS garantiza la regla incluso si el frontend fallara en validarla.
create policy "investments_delete_inactive_own" on public.investments for delete to authenticated
  using (auth.uid() = user_id and status = 'inactivo');

-- ---------------------------------------------------------------------------
-- 2. investment_balance_history
-- ---------------------------------------------------------------------------

create table public.investment_balance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  investment_id uuid not null references public.investments (id) on delete cascade,
  fecha date not null,
  balance numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_balance_history_balance_non_negative check (balance >= 0)
);

-- RN-165: una sola fila por instrumento y día — soporta el upsert al guardar el portafolio.
create unique index investment_balance_history_investment_fecha_key
  on public.investment_balance_history (investment_id, fecha);
create index investment_balance_history_user_fecha_idx
  on public.investment_balance_history (user_id, fecha);

create trigger investment_balance_history_set_updated_at
before update on public.investment_balance_history
for each row execute function public.set_updated_at();

alter table public.investment_balance_history enable row level security;

create policy "investment_balance_history_select_own" on public.investment_balance_history
  for select to authenticated using (auth.uid() = user_id);
create policy "investment_balance_history_insert_own" on public.investment_balance_history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "investment_balance_history_update_own" on public.investment_balance_history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sin política de delete — la única baja es en cascada al eliminar el instrumento (RN-181).

-- ---------------------------------------------------------------------------
-- 3. save_portfolio_config (CU-052 "Configurar el portafolio") — único RPC del módulo.
-- ---------------------------------------------------------------------------

create or replace function public.save_portfolio_config(p_items jsonb)
returns setof public.investments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_investment_id uuid;
  v_porcentaje numeric(5,2);
  v_balance numeric(14,2);
  v_status text;
  v_sum_active numeric(6,2) := 0;
  v_today date := current_date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  -- Primera pasada: valida el lote completo sin escribir nada — RN-162, el guardado es atómico y
  -- cualquier renglón inválido aborta todo (a diferencia de save_budgets, que omite renglones
  -- inválidos sin abortar el lote).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_investment_id := nullif(v_item->>'investment_id', '')::uuid;
    v_porcentaje := (v_item->>'porcentaje_objetivo')::numeric(5,2);
    v_balance := (v_item->>'balance_actual')::numeric(14,2);
    v_status := v_item->>'status';

    perform 1 from public.investments
    where id = v_investment_id and user_id = auth.uid()
    for update;

    if not found then
      raise exception 'BIZ_028';
    end if;

    if v_balance is null or v_balance < 0 then
      raise exception 'VALIDATION_006';
    end if;

    if v_porcentaje is null or v_porcentaje < 0 or v_porcentaje > 100 then
      raise exception 'VALIDATION_028';
    end if;

    if v_status = 'inactivo' then
      -- RN-160: un instrumento inactivo siempre tiene porcentaje objetivo 0 — se ignora cualquier
      -- valor capturado para ese renglón.
      v_porcentaje := 0;
    elsif v_status = 'activo' then
      -- RN-161: un instrumento activo debe tener porcentaje objetivo mayor a cero.
      if v_porcentaje <= 0 then
        raise exception 'VALIDATION_030';
      end if;
      v_sum_active := v_sum_active + v_porcentaje;
    else
      raise exception 'VALIDATION_028';
    end if;
  end loop;

  -- RN-159: la suma de porcentaje_objetivo de los instrumentos que queden activos debe ser
  -- exactamente 100.00, o bien 0 si el lote deja el portafolio sin ningún instrumento activo.
  if v_sum_active <> 0 and v_sum_active <> 100 then
    raise exception 'VALIDATION_029';
  end if;

  -- Segunda pasada: ya validado el lote completo, aplica todos los cambios. RN-165 — se registra
  -- una fila de histórico por cada instrumento del lote (el frontend siempre envía el portafolio
  -- completo), incluso si el balance no cambió respecto al anterior.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_investment_id := (v_item->>'investment_id')::uuid;
    v_porcentaje := (v_item->>'porcentaje_objetivo')::numeric(5,2);
    v_balance := (v_item->>'balance_actual')::numeric(14,2);
    v_status := v_item->>'status';
    if v_status = 'inactivo' then
      v_porcentaje := 0;
    end if;

    update public.investments
    set porcentaje_objetivo = v_porcentaje, balance_actual = v_balance, status = v_status
    where id = v_investment_id;

    insert into public.investment_balance_history (user_id, investment_id, fecha, balance)
    values (auth.uid(), v_investment_id, v_today, v_balance)
    on conflict (investment_id, fecha) do update set balance = excluded.balance;
  end loop;

  return query select * from public.investments where user_id = auth.uid();
end;
$$;

revoke all on function public.save_portfolio_config(jsonb) from public;
grant execute on function public.save_portfolio_config(jsonb) to authenticated;

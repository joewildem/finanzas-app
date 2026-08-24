-- Módulo Ahorros y Metas (CU-042 a CU-048) — docs/pdr/ahorros.md, docs/pdr/data-model-registry.md
--
-- Introduce `savings_goals` (metas de ahorro, independientes de cualquier cuenta), extiende
-- `transactions` con `meta_id` y el tipo `retiro_meta` (aportación/retiro es una fila única, a
-- diferencia de transferencia/pago a tarjeta — una meta no es una cuenta), y extiende `budgets`
-- con `meta_id`, retirando por completo el pseudo-registro `categoria_reservada` — cada meta activa
-- pasa a ser su propio renglón presupuestable, igual que una categoría real.

-- ---------------------------------------------------------------------------
-- 1. savings_goals
-- ---------------------------------------------------------------------------

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nombre text not null,
  emoji text not null default '💰',
  monto_objetivo numeric(14,2) not null,
  monto_inicial numeric(14,2) not null default 0,
  fecha_limite date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint savings_goals_nombre_length check (char_length(nombre) between 2 and 50),
  constraint savings_goals_monto_objetivo_positive check (monto_objetivo > 0),
  constraint savings_goals_monto_inicial_non_negative check (monto_inicial >= 0),
  -- RN-124: opcional; si se captura, hoy o una fecha futura al momento de crear/editar.
  constraint savings_goals_fecha_limite_valid check (fecha_limite is null or fecha_limite >= current_date)
);

-- RN-120: nombre único solo entre metas activas — una meta archivada libera su nombre.
create unique index savings_goals_user_nombre_active_key on public.savings_goals (user_id, nombre)
  where status = 'active';
create index savings_goals_user_status_idx on public.savings_goals (user_id, status);

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

create policy "savings_goals_select_own" on public.savings_goals for select to authenticated
  using (auth.uid() = user_id);
create policy "savings_goals_insert_own" on public.savings_goals for insert to authenticated
  with check (auth.uid() = user_id);
create policy "savings_goals_update_own" on public.savings_goals for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sin política de delete — baja lógica únicamente (status=archived), mismo patrón que accounts/categories.

-- ---------------------------------------------------------------------------
-- 2. transactions — meta_id, retiro_meta
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint transactions_tipo_check;
alter table public.transactions add constraint transactions_tipo_check
  check (tipo in ('ajuste', 'gasto', 'ingreso', 'transferencia', 'pago_tarjeta', 'aportacion_meta', 'retiro_meta'));

alter table public.transactions
  add column meta_id uuid references public.savings_goals (id);

alter table public.transactions
  add constraint transactions_meta_id_matches_tipo check (
    (tipo in ('aportacion_meta', 'retiro_meta') and meta_id is not null) or
    (tipo not in ('aportacion_meta', 'retiro_meta') and meta_id is null)
  );

-- CU-044/CU-047/CU-048: listar movimientos de una meta en orden cronológico descendente.
create index transactions_meta_fecha_idx on public.transactions (meta_id, fecha desc)
  where meta_id is not null;

-- ---------------------------------------------------------------------------
-- 3. budgets — meta_id reemplaza categoria_reservada
-- ---------------------------------------------------------------------------

drop index if exists public.budgets_user_reservada_mes_key;
alter table public.budgets drop constraint if exists budgets_category_xor_reservada;
alter table public.budgets drop constraint if exists budgets_categoria_reservada_valid;
alter table public.budgets drop column if exists categoria_reservada;

alter table public.budgets
  add column meta_id uuid references public.savings_goals (id);

alter table public.budgets
  add constraint budgets_category_xor_meta check (
    (category_id is not null and meta_id is null) or
    (category_id is null and meta_id is not null)
  );

create unique index budgets_user_meta_mes_key on public.budgets (user_id, meta_id, mes)
  where meta_id is not null;

-- ---------------------------------------------------------------------------
-- 4. save_budgets — mismo cuerpo vigente (20260811100000), meta_id en vez de categoria_reservada
-- ---------------------------------------------------------------------------

create or replace function public.save_budgets(p_mes text, p_items jsonb)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_category_id uuid;
  v_meta_id uuid;
  v_monto numeric(14,2);
  v_category public.categories;
  v_meta public.savings_goals;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := nullif(v_item->>'category_id', '')::uuid;
    v_meta_id := nullif(v_item->>'meta_id', '')::uuid;
    v_monto := nullif(v_item->>'monto', '')::numeric(14,2);

    if v_category_id is not null then
      select * into v_category from public.categories
      where id = v_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

      if not found then
        -- RN-058 alt.: categoría archivada/ajena/inexistente — se omite este ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_meta_id is not null then
      select * into v_meta from public.savings_goals
      where id = v_meta_id and user_id = auth.uid() and status = 'active';

      if not found then
        -- Mismo criterio que una categoría archivada/ajena — se omite el ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_monto is null then
      delete from public.budgets
      where user_id = auth.uid() and mes = p_mes
        and (
          (v_category_id is not null and category_id = v_category_id)
          or (v_meta_id is not null and meta_id = v_meta_id)
        );
      continue;
    end if;

    if v_monto < 0 then
      raise exception 'VALIDATION_016';
    end if;

    if v_category_id is not null then
      insert into public.budgets (user_id, category_id, mes, monto)
      values (auth.uid(), v_category_id, p_mes, v_monto)
      on conflict (user_id, category_id, mes) where category_id is not null
      do update set monto = excluded.monto;
    else
      insert into public.budgets (user_id, meta_id, mes, monto)
      values (auth.uid(), v_meta_id, p_mes, v_monto)
      on conflict (user_id, meta_id, mes) where meta_id is not null
      do update set monto = excluded.monto;
    end if;
  end loop;

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes;
end;
$$;

revoke all on function public.save_budgets(text, jsonb) from public;
grant execute on function public.save_budgets(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. copy_budget_month — mismo cuerpo vigente (20260810100000), meta_id en vez de categoria_reservada
-- ---------------------------------------------------------------------------

create or replace function public.copy_budget_month(
  p_mes_origen text,
  p_mes_destino text,
  p_confirmar_sobrescritura boolean default false
)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen_count int;
  v_destino_count int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes_origen !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_mes_destino !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  select count(*) into v_origen_count from public.budgets
  where user_id = auth.uid() and mes = p_mes_origen;

  if v_origen_count = 0 then
    raise exception 'BIZ_018';
  end if;

  select count(*) into v_destino_count from public.budgets
  where user_id = auth.uid() and mes = p_mes_destino;

  if v_destino_count > 0 and not p_confirmar_sobrescritura then
    raise exception 'BIZ_017';
  end if;

  if v_destino_count > 0 then
    delete from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
  end if;

  -- Las categorías/metas archivadas al momento de la copia no se incluyen, aunque hayan tenido
  -- presupuesto en el mes de origen (alt. flujo de CU-020).
  insert into public.budgets (user_id, category_id, meta_id, mes, monto)
  select auth.uid(), b.category_id, b.meta_id, p_mes_destino, b.monto
  from public.budgets b
  left join public.categories c on c.id = b.category_id
  left join public.savings_goals g on g.id = b.meta_id
  where b.user_id = auth.uid() and b.mes = p_mes_origen
    and (b.category_id is null or c.status = 'active')
    and (b.meta_id is null or g.status = 'active');

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
end;
$$;

revoke all on function public.copy_budget_month(text, text, boolean) from public;
grant execute on function public.copy_budget_month(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. create_goal_contribution (CU-047)
-- ---------------------------------------------------------------------------

create or replace function public.create_goal_contribution(
  p_meta_id uuid,
  p_account_id uuid,
  p_monto numeric,
  p_fecha timestamptz,
  p_nota text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_meta public.savings_goals;
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  -- RN-141: la cuenta de origen debe ser débito o efectivo, activa, propia.
  if not found or v_account.status <> 'active' or v_account.tipo not in ('debito', 'efectivo') then
    raise exception 'BIZ_010';
  end if;

  select * into v_meta from public.savings_goals
  where id = p_meta_id and user_id = auth.uid() and status = 'active';

  if not found then
    raise exception 'BIZ_023';
  end if;

  -- RN-139: mismo signo que un gasto — sale de la cuenta.
  v_signed_monto := -abs(p_monto);

  insert into public.transactions (user_id, account_id, tipo, meta_id, concepto, monto, nota, fecha)
  values (
    auth.uid(), p_account_id, 'aportacion_meta', p_meta_id,
    'Aportación a meta: ' || v_meta.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_goal_contribution(uuid, uuid, numeric, timestamptz, text) from public;
grant execute on function public.create_goal_contribution(uuid, uuid, numeric, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_goal_withdrawal (CU-048)
-- ---------------------------------------------------------------------------

create or replace function public.create_goal_withdrawal(
  p_meta_id uuid,
  p_account_id uuid,
  p_monto numeric,
  p_fecha timestamptz,
  p_nota text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  -- RN-147: la cuenta destino debe ser débito o efectivo, activa, propia.
  if not found or v_account.status <> 'active' or v_account.tipo not in ('debito', 'efectivo') then
    raise exception 'BIZ_010';
  end if;

  select * into v_meta from public.savings_goals
  where id = p_meta_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'BIZ_023';
  end if;

  -- RN-126: monto_aportado_actual = monto_inicial - suma con signo de las transacciones de la meta.
  select v_meta.monto_inicial - coalesce(sum(t.monto), 0) into v_monto_aportado_actual
  from public.transactions t
  where t.meta_id = p_meta_id and t.tipo in ('aportacion_meta', 'retiro_meta');

  -- RN-146: el retiro no puede dejar el aportado calculado en negativo.
  if p_monto > v_monto_aportado_actual then
    raise exception 'BIZ_025';
  end if;

  -- RN-145: mismo signo que un ingreso — entra a la cuenta.
  v_signed_monto := abs(p_monto);

  insert into public.transactions (user_id, account_id, tipo, meta_id, concepto, monto, nota, fecha)
  values (
    auth.uid(), p_account_id, 'retiro_meta', p_meta_id,
    'Retiro de meta: ' || v_meta.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_goal_withdrawal(uuid, uuid, numeric, timestamptz, text) from public;
grant execute on function public.create_goal_withdrawal(uuid, uuid, numeric, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. update_transaction — mismo cuerpo vigente (20260811110000), + rama de meta (RN-152)
-- ---------------------------------------------------------------------------
-- Agrega un parámetro nuevo (p_meta_id) al final de la firma — Postgres solo reemplaza una función
-- con `create or replace` cuando la firma coincide exactamente; con un parámetro extra quedaría
-- como un OVERLOAD nuevo en vez de sustituir el de 5 argumentos, dejando ambas versiones vivas y
-- otorgadas a `authenticated`. Se elimina explícitamente la versión anterior primero.
drop function if exists public.update_transaction(uuid, numeric, uuid, timestamptz, text);

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha timestamptz,
  p_nota text,
  p_meta_id uuid default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_old_monto numeric(14, 2);
  v_new_monto numeric(14, 2);
  v_category public.categories;
  v_group public.categories;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_related public.transactions;
  v_new_related_monto numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_tx from public.transactions
  where id = p_transaction_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'BIZ_014';
  end if;
  if v_tx.tipo = 'ajuste' then
    raise exception 'BIZ_015';
  end if;

  v_old_monto := v_tx.monto;
  v_new_monto := case when v_old_monto < 0 then -abs(p_monto) else abs(p_monto) end;

  if v_tx.tipo in ('gasto', 'ingreso') then
    select * into v_category from public.categories
    where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

    if not found then
      raise exception 'BIZ_009';
    end if;

    select * into v_group from public.categories where id = v_category.grupo_id;

    if v_tx.tipo = 'gasto' and v_group.flujo <> 'outflow' then
      raise exception 'BIZ_009';
    end if;
    if v_tx.tipo = 'ingreso' and v_group.flujo <> 'inflow' then
      raise exception 'BIZ_009';
    end if;

    update public.transactions
    set monto = v_new_monto, category_id = v_category.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  elsif v_tx.tipo in ('aportacion_meta', 'retiro_meta') then
    select * into v_meta from public.savings_goals
    where id = p_meta_id and user_id = auth.uid() and status = 'active'
    for update;

    if not found then
      raise exception 'BIZ_023';
    end if;

    if v_tx.tipo = 'retiro_meta' then
      -- RN-146/RN-152: recalcula el aportado excluyendo la propia transacción que se edita.
      select v_meta.monto_inicial - coalesce(sum(t.monto), 0) into v_monto_aportado_actual
      from public.transactions t
      where t.meta_id = p_meta_id and t.tipo in ('aportacion_meta', 'retiro_meta') and t.id <> p_transaction_id;

      if p_monto > v_monto_aportado_actual then
        raise exception 'BIZ_025';
      end if;
    end if;

    update public.transactions
    set monto = v_new_monto, meta_id = v_meta.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  else
    -- RN-053: la categoría se ignora para transferencia/pago_tarjeta — nunca la llevan.
    update public.transactions
    set monto = v_new_monto, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  end if;

  update public.accounts set saldo_actual = saldo_actual - v_old_monto + v_new_monto where id = v_tx.account_id;

  -- RN-052: si está enlazada, el monto (misma magnitud, signo opuesto), fecha y nota se reflejan
  -- de forma espejada en el documento relacionado y su cuenta — es una sola operación lógica
  -- representada como dos filas. aportacion_meta/retiro_meta nunca llegan aquí con
  -- transaccion_relacionada_id distinto de null.
  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions
    where id = v_tx.transaccion_relacionada_id
    for update;

    v_new_related_monto := -v_new_monto;

    update public.transactions
    set monto = v_new_related_monto, fecha = v_tx.fecha, nota = v_tx.nota
    where id = v_related.id;

    update public.accounts
    set saldo_actual = saldo_actual - v_related.monto + v_new_related_monto
    where id = v_related.account_id;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid) to authenticated;

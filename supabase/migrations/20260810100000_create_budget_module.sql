-- Módulo Presupuesto (CU-019, CU-020, CU-022) — docs/pdr/presupuesto.md, docs/pdr/data-model-registry.md
--
-- Crea `budgets` (presupuesto por categoría y mes, más el pseudo-registro reservado de Ahorros) y
-- los dos RPCs de escritura: `save_budgets` (CU-019, guardado en lote de la vista completa del mes)
-- y `copy_budget_month` (CU-020, copiar un mes existente hacia otro). CU-022 (resumen real vs.
-- presupuestado) no necesita RPC — se calcula al vuelo en el cliente a partir de `budgets` y
-- `transactions`, mismo patrón que `accounts.disponible`.

-- ---------------------------------------------------------------------------
-- Tabla `budgets`
-- ---------------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  categoria_reservada text,
  mes text not null,
  monto numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budgets_mes_format check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint budgets_monto_positive check (monto > 0),
  constraint budgets_categoria_reservada_valid check (categoria_reservada is null or categoria_reservada = 'ahorros'),
  -- RN-070: category_id XOR categoria_reservada='ahorros' — Ahorros no existe todavía como
  -- categoría real (módulo de Ahorros y Metas, v1.1), se usa un literal reservado en su lugar.
  constraint budgets_category_xor_reservada check (
    (category_id is not null and categoria_reservada is null) or
    (category_id is null and categoria_reservada = 'ahorros')
  )
);

comment on table public.budgets is
  'Presupuesto por categoría y mes (CU-019), más el pseudo-registro reservado de Ahorros (RN-070).';

-- RN-059: un solo presupuesto por categoría real y mes. Índice parcial porque category_id es NULL
-- en la fila de Ahorros, y los NULL nunca colisionan en un índice único normal.
create unique index budgets_user_category_mes_key on public.budgets (user_id, category_id, mes)
  where category_id is not null;
-- RN-059: un solo presupuesto de Ahorros por mes.
create unique index budgets_user_reservada_mes_key on public.budgets (user_id, categoria_reservada, mes)
  where categoria_reservada is not null;
-- CU-019/CU-020/CU-022: consultar o reemplazar todo el presupuesto de un usuario en un mes.
create index budgets_user_mes_idx on public.budgets (user_id, mes);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — `budgets`
-- ---------------------------------------------------------------------------

alter table public.budgets enable row level security;

create policy "budgets_select_own"
on public.budgets
for select
to authenticated
using (auth.uid() = user_id);

-- Sin política de insert/update/delete: toda escritura pasa exclusivamente por los RPCs de abajo
-- (security definer), mismo patrón "RPC-only" que accounts.saldo_actual y archive_category_group.

-- ---------------------------------------------------------------------------
-- CU-019 — Guardar el presupuesto del mes (lote)
-- ---------------------------------------------------------------------------
-- Una sola acción de guardado para todas las filas que el usuario editó en la vista. `p_items` es
-- un arreglo JSON de { category_id, categoria_reservada, monto } — monto=null indica "eliminar"
-- (RN-060, deja vacío el campo). Una categoría archivada/ajena se omite sin abortar el resto del
-- lote (alt. flujo de RN-058); un `categoria_reservada` inválido o un monto <= 0 sí abortan, porque
-- el cliente nunca debería enviarlos (bug de cliente, no condición de carrera).

create or replace function public.save_budgets(p_mes text, p_items jsonb)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_category_id uuid;
  v_categoria_reservada text;
  v_monto numeric(14,2);
  v_category public.categories;
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
    v_categoria_reservada := nullif(v_item->>'categoria_reservada', '');
    v_monto := nullif(v_item->>'monto', '')::numeric(14,2);

    if v_categoria_reservada is not null and v_categoria_reservada <> 'ahorros' then
      raise exception 'VALIDATION_019';
    end if;

    if v_category_id is not null then
      select * into v_category from public.categories
      where id = v_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

      if not found then
        -- RN-058 alt.: categoría archivada/ajena/inexistente — se omite este ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_monto is null then
      delete from public.budgets
      where user_id = auth.uid() and mes = p_mes
        and (
          (v_category_id is not null and category_id = v_category_id)
          or (v_categoria_reservada is not null and categoria_reservada = v_categoria_reservada)
        );
      continue;
    end if;

    if v_monto <= 0 then
      raise exception 'VALIDATION_016';
    end if;

    if v_category_id is not null then
      insert into public.budgets (user_id, category_id, mes, monto)
      values (auth.uid(), v_category_id, p_mes, v_monto)
      on conflict (user_id, category_id, mes) where category_id is not null
      do update set monto = excluded.monto;
    else
      insert into public.budgets (user_id, categoria_reservada, mes, monto)
      values (auth.uid(), v_categoria_reservada, p_mes, v_monto)
      on conflict (user_id, categoria_reservada, mes) where categoria_reservada is not null
      do update set monto = excluded.monto;
    end if;
  end loop;

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes;
end;
$$;

revoke all on function public.save_budgets(text, jsonb) from public;
grant execute on function public.save_budgets(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- CU-020 — Copiar presupuesto de un mes a otro
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

  -- Las categorías archivadas al momento de la copia no se incluyen, aunque hayan tenido
  -- presupuesto en el mes de origen (alt. flujo de CU-020).
  insert into public.budgets (user_id, category_id, categoria_reservada, mes, monto)
  select auth.uid(), b.category_id, b.categoria_reservada, p_mes_destino, b.monto
  from public.budgets b
  left join public.categories c on c.id = b.category_id
  where b.user_id = auth.uid() and b.mes = p_mes_origen
    and (b.category_id is null or (c.status = 'active'));

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
end;
$$;

revoke all on function public.copy_budget_month(text, text, boolean) from public;
grant execute on function public.copy_budget_month(text, text, boolean) to authenticated;

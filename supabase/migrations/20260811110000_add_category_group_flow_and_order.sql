-- Módulo Categorías — docs/pdr/categorias.md (RN-118, RN-119), docs/pdr/data-model-registry.md
--
-- Agrega dos columnas estructurales exclusivas de grupo (`tipo='grupo'`), mismo patrón que
-- `color`/`icono` (categories_color_only_grupo / categories_icono_only_categoria):
-- - `flujo`: Inflow/Outflow, obligatorio en creación — reemplaza la identificación por nombre que
--   usaban Budget y las RPCs de Transacciones (RN-039), frágil ante un grupo renombrado.
-- - `orden`: posición manual del grupo, asignada al crear (siguiente disponible) y reordenable
--   desde la lista de Categorías (RN-119) — reemplaza el orden fijo hardcodeado que tenía Budget
--   para las tarjetas de Outflow.

create type public.category_flow as enum ('inflow', 'outflow');

alter table public.categories
  add column flujo public.category_flow,
  add column orden integer;

-- Backfill de grupos ya existentes ANTES de agregar las CHECK constraints de abajo — si se agregan
-- primero, Postgres las valida de inmediato contra filas de grupo que todavía tienen flujo/orden en
-- NULL (recién agregadas las columnas) y la migración falla.
-- "Income" pasa a `inflow`, cualquier otro grupo a `outflow`.
update public.categories
set flujo = case when nombre = 'Income' then 'inflow' else 'outflow' end::public.category_flow
where tipo = 'grupo';

-- Backfill de orden: los 5 grupos semilla conservan el orden visual que ya tenían (Bills, Needs,
-- Wants, Investment, Income); cualquier grupo adicional o renombrado por el usuario se ordena
-- alfabéticamente a continuación — reordenable manualmente después vía CU-009.
with ranked as (
  select id,
    row_number() over (
      partition by user_id
      order by
        case nombre
          when 'Bills' then 0
          when 'Needs' then 1
          when 'Wants' then 2
          when 'Investment' then 3
          when 'Income' then 4
          else 5
        end,
        nombre
    ) - 1 as rn
  from public.categories
  where tipo = 'grupo'
)
update public.categories c
set orden = ranked.rn
from ranked
where c.id = ranked.id;

alter table public.categories
  add constraint categories_flujo_only_grupo check (
    (tipo = 'grupo' and flujo is not null) or (tipo = 'categoria' and flujo is null)
  ),
  add constraint categories_orden_only_grupo check (
    (tipo = 'grupo' and orden is not null) or (tipo = 'categoria' and orden is null)
  );

-- Siembra por defecto para nuevos usuarios — mismo cuerpo que la versión original
-- (supabase/migrations/20260807121135_create_categories_module.sql), agregando `flujo`/`orden` a
-- cada grupo.
create or replace function public.seed_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  -- Bills
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Bills', '#EF4444', 'outflow', 0, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Rent', v_group_id, 'home', 'active'),
    (target_user_id, 'categoria', 'Electricity', v_group_id, 'bolt', 'active'),
    (target_user_id, 'categoria', 'Internet', v_group_id, 'wifi', 'active'),
    (target_user_id, 'categoria', 'Phone', v_group_id, 'phone', 'active');

  -- Needs
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Needs', '#3B82F6', 'outflow', 1, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Groceries', v_group_id, 'cart', 'active'),
    (target_user_id, 'categoria', 'Transport', v_group_id, 'car', 'active'),
    (target_user_id, 'categoria', 'Health', v_group_id, 'heart', 'active');

  -- Wants
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Wants', '#A855F7', 'outflow', 2, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Dining Out', v_group_id, 'utensils', 'active'),
    (target_user_id, 'categoria', 'Entertainment', v_group_id, 'film', 'active'),
    (target_user_id, 'categoria', 'Subscriptions', v_group_id, 'repeat', 'active');

  -- Investment
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Investment', '#22C55E', 'outflow', 3, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Stocks', v_group_id, 'trend-up', 'active'),
    (target_user_id, 'categoria', 'Retirement', v_group_id, 'wallet', 'active');

  -- Income
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Income', '#14B8A6', 'inflow', 4, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Salary', v_group_id, 'wallet', 'active'),
    (target_user_id, 'categoria', 'Other Income', v_group_id, 'generic', 'active');
end;
$$;

-- RN-039 (transacciones): create_transaction/update_transaction dejan de comparar el grupo por
-- nombre y validan contra `categories.flujo` — mismo cuerpo que la versión original de cada
-- función, solo cambia la condición de las dos líneas señaladas.

create or replace function public.create_transaction(
  p_account_id uuid,
  p_tipo text,
  p_monto numeric,
  p_category_id uuid,
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
  v_category public.categories;
  v_group public.categories;
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_tipo not in ('gasto', 'ingreso') then
    raise exception 'VALIDATION_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  if not found or v_account.status <> 'active' then
    raise exception 'BIZ_010';
  end if;

  select * into v_category from public.categories
  where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

  if not found then
    raise exception 'BIZ_009';
  end if;

  select * into v_group from public.categories where id = v_category.grupo_id;

  if p_tipo = 'gasto' and v_group.flujo <> 'outflow' then
    raise exception 'BIZ_009';
  end if;
  if p_tipo = 'ingreso' and v_group.flujo <> 'inflow' then
    raise exception 'BIZ_009';
  end if;

  v_signed_monto := case when p_tipo = 'gasto' then -abs(p_monto) else abs(p_monto) end;

  insert into public.transactions (user_id, account_id, tipo, category_id, concepto, monto, nota, fecha)
  values (auth.uid(), p_account_id, p_tipo, p_category_id, v_category.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now()))
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text) from public;
grant execute on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text) to authenticated;

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha timestamptz,
  p_nota text
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
  -- representada como dos filas.
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

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text) to authenticated;

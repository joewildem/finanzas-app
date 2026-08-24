-- Módulo Transacciones (CU-035) — docs/pdr/transacciones.md, docs/pdr/data-model-registry.md
--
-- Acciones en lote sobre transacciones desde el listado (CU-016): cambiar cuenta, cambiar fecha,
-- editar nota (los tres bajo un mismo RPC, `p_account_id`/`p_fecha`/`p_nota` nullable — "aplica
-- solo el campo presente", igual que el contrato REST documentado) y eliminar (RPC aparte, mismo
-- patrón atómico que `delete_transaction`, CU-018). `tipo = 'ajuste'` queda excluido de cualquier
-- acción en lote (RN-107, mismo criterio que CU-017/CU-018).

-- ---------------------------------------------------------------------------
-- CU-035 — Cambiar cuenta / fecha / nota en lote (atómico)
-- ---------------------------------------------------------------------------
-- RN-108: "Cambiar cuenta" sí permite reasignar `account_id` en lote (a diferencia de la edición
-- individual, CU-017, donde no es editable) — excepto si la selección incluye una transacción
-- enlazada, donde reasignar solo un lado del par rompería la relación (BIZ_022).

create or replace function public.batch_update_transactions(
  p_ids uuid[],
  p_account_id uuid default null,
  p_fecha timestamptz default null,
  p_nota text default null
)
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected_count int;
  v_found_count int;
  v_ajuste_count int;
  v_linked_count int;
  v_tx record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'VALIDATION_023';
  end if;
  v_selected_count := array_length(p_ids, 1);

  select count(*) into v_found_count from public.transactions where id = any(p_ids) and user_id = auth.uid();
  if v_found_count <> v_selected_count then
    raise exception 'BIZ_014';
  end if;

  -- RN-107
  select count(*) into v_ajuste_count
  from public.transactions
  where id = any(p_ids) and user_id = auth.uid() and tipo = 'ajuste';
  if v_ajuste_count > 0 then
    raise exception 'BIZ_015';
  end if;

  if p_account_id is not null then
    -- RN-108/BIZ_022
    select count(*) into v_linked_count
    from public.transactions
    where id = any(p_ids) and user_id = auth.uid() and transaccion_relacionada_id is not null;
    if v_linked_count > 0 then
      raise exception 'BIZ_022';
    end if;

    if not exists (
      select 1 from public.accounts where id = p_account_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'BIZ_010';
    end if;

    -- Revierte cada transacción de su cuenta original y la aplica a la cuenta destino — `saldo_actual`
    -- se ajusta con una resta/suma relativa por fila (segura sin lock explícito de `accounts`: cada
    -- UPDATE es atómico por sí mismo), ya que el destino es común pero el origen varía por fila.
    for v_tx in select * from public.transactions where id = any(p_ids) and user_id = auth.uid() for update loop
      update public.accounts set saldo_actual = saldo_actual - v_tx.monto where id = v_tx.account_id;
      update public.accounts set saldo_actual = saldo_actual + v_tx.monto where id = p_account_id;
    end loop;

    update public.transactions set account_id = p_account_id where id = any(p_ids) and user_id = auth.uid();
  end if;

  -- RN-109: sobrescribe con el mismo valor en todas, no es un corrimiento relativo.
  if p_fecha is not null then
    update public.transactions set fecha = p_fecha where id = any(p_ids) and user_id = auth.uid();
  end if;

  -- RN-110: sobrescribe con el mismo texto en todas, no concatena con la nota existente.
  if p_nota is not null then
    update public.transactions set nota = p_nota where id = any(p_ids) and user_id = auth.uid();
  end if;

  return query select * from public.transactions where id = any(p_ids) and user_id = auth.uid();
end;
$$;

revoke all on function public.batch_update_transactions(uuid[], uuid, timestamptz, text) from public;
grant execute on function public.batch_update_transactions(uuid[], uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- CU-035 — Eliminar en lote (atómico)
-- ---------------------------------------------------------------------------
-- RN-111: mismo efecto que `delete_transaction` (CU-018) por cada fila del lote, en una sola
-- operación. Si el par enlazado de una transacción seleccionada NO está también en `p_ids`, se
-- revierte su saldo aquí explícitamente y se confía en la cascada de la FK
-- (`transacciones.transaccion_relacionada_id ... on delete cascade`, 20260807150000) para borrarlo;
-- si SÍ está en `p_ids`, se revierte/borra como cualquier otra fila del lote, sin duplicar trabajo.

create or replace function public.batch_delete_transactions(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected_count int;
  v_found_count int;
  v_ajuste_count int;
  v_tx record;
  v_related public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'VALIDATION_023';
  end if;
  v_selected_count := array_length(p_ids, 1);

  select count(*) into v_found_count from public.transactions where id = any(p_ids) and user_id = auth.uid();
  if v_found_count <> v_selected_count then
    raise exception 'BIZ_014';
  end if;

  select count(*) into v_ajuste_count
  from public.transactions
  where id = any(p_ids) and user_id = auth.uid() and tipo = 'ajuste';
  if v_ajuste_count > 0 then
    raise exception 'BIZ_015';
  end if;

  for v_tx in select * from public.transactions where id = any(p_ids) and user_id = auth.uid() for update loop
    update public.accounts set saldo_actual = saldo_actual - v_tx.monto where id = v_tx.account_id;

    if v_tx.transaccion_relacionada_id is not null and not (v_tx.transaccion_relacionada_id = any(p_ids)) then
      select * into v_related from public.transactions where id = v_tx.transaccion_relacionada_id for update;
      if found then
        update public.accounts set saldo_actual = saldo_actual - v_related.monto where id = v_related.account_id;
      end if;
    end if;
  end loop;

  delete from public.transactions where id = any(p_ids) and user_id = auth.uid();
end;
$$;

revoke all on function public.batch_delete_transactions(uuid[]) from public;
grant execute on function public.batch_delete_transactions(uuid[]) to authenticated;

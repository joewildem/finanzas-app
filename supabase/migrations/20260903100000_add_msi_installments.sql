-- Meses Sin Intereses (MSI) — seguimiento de compras a meses sin intereses en tarjeta de crédito.
--
-- Sin documento de PRD todavía (diseño validado en conversación con el usuario, pendiente de
-- formalizar en docs/pdr/ una vez confirmado el comportamiento en uso real) — por eso esta migración
-- no referencia números de CU/RN, a diferencia del resto del repositorio. Se numerará al cerrar.
--
-- Modelo: el monto completo de una compra a MSI ya se refleja una sola vez en saldo_actual de la
-- tarjeta, vía el mecanismo de gasto existente — no se abre ninguna entidad ni saldo nuevo. `msi_meses`
-- es solo metadata en la transacción de gasto original que originó el plan: cuántos meses dura. Un
-- "plan MSI" activo en un mes dado se deriva en tiempo de consulta (mismo criterio ya usado en
-- Dashboard/Budget: agregación, sin snapshots) comparando `fecha`/`msi_meses` contra el mes en
-- cuestión — no existe tabla propia para los planes.

-- ---------------------------------------------------------------------------
-- 1. transactions — msi_meses
-- ---------------------------------------------------------------------------

alter table public.transactions
  add column msi_meses smallint;

-- Solo aplica a gastos, con un rango razonable de meses (3/6/9/12/18 son los planes típicos en
-- México, pero se deja un rango amplio en vez de un catálogo cerrado).
alter table public.transactions
  add constraint transactions_msi_meses_valid check (
    msi_meses is null or (tipo = 'gasto' and msi_meses between 2 and 60)
  );

-- ---------------------------------------------------------------------------
-- 2. create_transaction — acepta msi_meses opcional (solo gasto contra cuenta de crédito)
-- ---------------------------------------------------------------------------

-- Mismo patrón ya usado para update_transaction (20260825100000): un parámetro nuevo cambia la
-- firma, así que la versión vieja no queda reemplazada por "create or replace" — hay que tirarla
-- explícitamente o quedan ambas coexistiendo como sobrecargas.
drop function if exists public.create_transaction(uuid, text, numeric, uuid, timestamptz, text);

create or replace function public.create_transaction(
  p_account_id uuid,
  p_tipo text,
  p_monto numeric,
  p_category_id uuid,
  p_fecha timestamptz,
  p_nota text,
  p_msi_meses smallint default null
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

  if p_msi_meses is not null then
    if p_tipo <> 'gasto' or v_account.tipo <> 'credito' then
      raise exception 'BIZ_034';
    end if;
    if p_msi_meses < 2 or p_msi_meses > 60 then
      raise exception 'VALIDATION_038';
    end if;
  end if;

  select * into v_category from public.categories
  where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

  if not found then
    raise exception 'BIZ_009';
  end if;

  select * into v_group from public.categories where id = v_category.grupo_id;

  if p_tipo = 'gasto' and v_group.flujo = 'inflow' then
    raise exception 'BIZ_009';
  end if;
  if p_tipo = 'ingreso' and v_group.flujo <> 'inflow' then
    raise exception 'BIZ_009';
  end if;

  v_signed_monto := case when p_tipo = 'gasto' then -abs(p_monto) else abs(p_monto) end;

  insert into public.transactions (user_id, account_id, tipo, category_id, concepto, monto, nota, fecha, msi_meses)
  values (
    auth.uid(), p_account_id, p_tipo, p_category_id, v_category.nombre, v_signed_monto, p_nota,
    coalesce(p_fecha, now()), p_msi_meses
  )
  returning * into v_transaction;

  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then -v_signed_monto else v_signed_monto end)
  where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text, smallint) from public;
grant execute on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_transaction — acepta msi_meses opcional en la rama gasto/ingreso
-- ---------------------------------------------------------------------------

drop function if exists public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric);

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha timestamptz,
  p_nota text,
  p_meta_id uuid default null,
  p_deuda_id uuid default null,
  p_monto_capital numeric default null,
  p_monto_interes numeric default null,
  p_msi_meses smallint default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_account public.accounts;
  v_old_monto numeric(14, 2);
  v_new_monto numeric(14, 2);
  v_category public.categories;
  v_group public.categories;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_deuda public.debts;
  v_saldo_actual numeric(14, 2);
  v_related public.transactions;
  v_related_account public.accounts;
  v_new_related_monto numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
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

  select * into v_account from public.accounts where id = v_tx.account_id for update;

  if v_tx.tipo = 'pago_deuda' then
    if p_monto_capital is null or p_monto_interes is null or p_monto_capital < 0 or p_monto_interes < 0 then
      raise exception 'VALIDATION_006';
    end if;
    if p_monto_capital + p_monto_interes <= 0 then
      raise exception 'VALIDATION_012';
    end if;
  else
    if p_monto is null or p_monto <= 0 then
      raise exception 'VALIDATION_012';
    end if;
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

    if v_tx.tipo = 'gasto' and v_group.flujo = 'inflow' then
      raise exception 'BIZ_009';
    end if;
    if v_tx.tipo = 'ingreso' and v_group.flujo <> 'inflow' then
      raise exception 'BIZ_009';
    end if;

    if p_msi_meses is not null then
      if v_tx.tipo <> 'gasto' or v_account.tipo <> 'credito' then
        raise exception 'BIZ_034';
      end if;
      if p_msi_meses < 2 or p_msi_meses > 60 then
        raise exception 'VALIDATION_038';
      end if;
    end if;

    update public.transactions
    set monto = v_new_monto, category_id = v_category.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota,
        msi_meses = p_msi_meses
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
  elsif v_tx.tipo = 'pago_deuda' then
    select * into v_deuda from public.debts
    where id = p_deuda_id and user_id = auth.uid() and status = 'active'
    for update;

    if not found then
      raise exception 'BIZ_031';
    end if;

    select v_deuda.monto_original - coalesce(sum(t.monto_capital), 0) into v_saldo_actual
    from public.transactions t
    where t.deuda_id = p_deuda_id and t.tipo = 'pago_deuda' and t.id <> p_transaction_id;

    if p_monto_capital > v_saldo_actual then
      raise exception 'BIZ_033';
    end if;

    v_new_monto := -(p_monto_capital + p_monto_interes);

    update public.transactions
    set monto = v_new_monto, deuda_id = v_deuda.id, monto_capital = p_monto_capital,
        monto_interes = p_monto_interes, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  else
    update public.transactions
    set monto = v_new_monto, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  end if;

  update public.accounts
  set saldo_actual = saldo_actual +
    (case when v_account.tipo = 'credito' then -(v_tx.monto - v_old_monto) else (v_tx.monto - v_old_monto) end)
  where id = v_tx.account_id;

  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions
    where id = v_tx.transaccion_relacionada_id
    for update;

    select * into v_related_account from public.accounts where id = v_related.account_id for update;

    v_new_related_monto := -v_tx.monto;

    update public.transactions
    set monto = v_new_related_monto, fecha = v_tx.fecha, nota = v_tx.nota
    where id = v_related.id;

    update public.accounts
    set saldo_actual = saldo_actual +
      (case when v_related_account.tipo = 'credito' then -(v_new_related_monto - v_related.monto) else (v_new_related_monto - v_related.monto) end)
    where id = v_related.account_id;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric, smallint) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. budgets — msi_transaction_id, cuarta opción mutuamente excluyente
-- ---------------------------------------------------------------------------

alter table public.budgets drop constraint budgets_category_xor_meta_xor_deuda;

alter table public.budgets
  add column msi_transaction_id uuid references public.transactions (id);

alter table public.budgets
  add constraint budgets_category_xor_meta_xor_deuda_xor_msi check (
    (case when category_id is not null then 1 else 0 end
     + case when meta_id is not null then 1 else 0 end
     + case when deuda_id is not null then 1 else 0 end
     + case when msi_transaction_id is not null then 1 else 0 end) = 1
  );

create unique index budgets_user_msi_transaction_mes_key on public.budgets (user_id, msi_transaction_id, mes)
  where msi_transaction_id is not null;

-- ---------------------------------------------------------------------------
-- 5. save_budgets — rama msi_transaction_id (sin "real" — solo Assigned, ver use-monthly-*-actuals)
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
  v_deuda_id uuid;
  v_msi_transaction_id uuid;
  v_monto numeric(14,2);
  v_category public.categories;
  v_meta public.savings_goals;
  v_deuda public.debts;
  v_msi_tx public.transactions;
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
    v_deuda_id := nullif(v_item->>'deuda_id', '')::uuid;
    v_msi_transaction_id := nullif(v_item->>'msi_transaction_id', '')::uuid;
    v_monto := nullif(v_item->>'monto', '')::numeric(14,2);

    if v_category_id is not null then
      select * into v_category from public.categories
      where id = v_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

      if not found then
        continue;
      end if;
    end if;

    if v_meta_id is not null then
      select * into v_meta from public.savings_goals
      where id = v_meta_id and user_id = auth.uid() and status = 'active';

      if not found then
        continue;
      end if;
    end if;

    if v_deuda_id is not null then
      select * into v_deuda from public.debts
      where id = v_deuda_id and user_id = auth.uid() and status = 'active';

      if not found then
        continue;
      end if;
    end if;

    if v_msi_transaction_id is not null then
      select * into v_msi_tx from public.transactions
      where id = v_msi_transaction_id and user_id = auth.uid() and tipo = 'gasto' and msi_meses is not null;

      -- El plan ya no existe o dejó de ser MSI (se editó la transacción) — se omite el ítem, no
      -- aborta el lote, mismo criterio que una categoría/meta/deuda archivada o ajena.
      if not found then
        continue;
      end if;
    end if;

    if v_monto is null then
      delete from public.budgets
      where user_id = auth.uid() and mes = p_mes
        and (
          (v_category_id is not null and category_id = v_category_id)
          or (v_meta_id is not null and meta_id = v_meta_id)
          or (v_deuda_id is not null and deuda_id = v_deuda_id)
          or (v_msi_transaction_id is not null and msi_transaction_id = v_msi_transaction_id)
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
    elsif v_meta_id is not null then
      insert into public.budgets (user_id, meta_id, mes, monto)
      values (auth.uid(), v_meta_id, p_mes, v_monto)
      on conflict (user_id, meta_id, mes) where meta_id is not null
      do update set monto = excluded.monto;
    elsif v_deuda_id is not null then
      insert into public.budgets (user_id, deuda_id, mes, monto)
      values (auth.uid(), v_deuda_id, p_mes, v_monto)
      on conflict (user_id, deuda_id, mes) where deuda_id is not null
      do update set monto = excluded.monto;
    else
      insert into public.budgets (user_id, msi_transaction_id, mes, monto)
      values (auth.uid(), v_msi_transaction_id, p_mes, v_monto)
      on conflict (user_id, msi_transaction_id, mes) where msi_transaction_id is not null
      do update set monto = excluded.monto;
    end if;
  end loop;

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes;
end;
$$;

revoke all on function public.save_budgets(text, jsonb) from public;
grant execute on function public.save_budgets(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. copy_budget_month — solo copia un renglón msi_transaction_id si el plan sigue activo en el
--    mes destino (a diferencia de category/meta/deuda, un plan MSI expira por sí solo tras N meses).
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
  v_mes_destino_inicio date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes_origen !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_mes_destino !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  v_mes_destino_inicio := to_date(p_mes_destino || '-01', 'YYYY-MM-DD');

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

  -- Las categorías/metas/deudas archivadas al momento de la copia no se incluyen, aunque hayan
  -- tenido presupuesto en el mes de origen (alt. flujo de CU-020). Un plan MSI se incluye solo si
  -- el mes destino todavía cae dentro de su ventana [mes de la compra, mes de la compra + meses).
  insert into public.budgets (user_id, category_id, meta_id, deuda_id, msi_transaction_id, mes, monto)
  select auth.uid(), b.category_id, b.meta_id, b.deuda_id, b.msi_transaction_id, p_mes_destino, b.monto
  from public.budgets b
  left join public.categories c on c.id = b.category_id
  left join public.savings_goals g on g.id = b.meta_id
  left join public.debts d on d.id = b.deuda_id
  left join public.transactions t on t.id = b.msi_transaction_id
  where b.user_id = auth.uid() and b.mes = p_mes_origen
    and (b.category_id is null or c.status = 'active')
    and (b.meta_id is null or g.status = 'active')
    and (b.deuda_id is null or d.status = 'active')
    and (
      b.msi_transaction_id is null
      or (
        t.msi_meses is not null
        and date_trunc('month', t.fecha) <= v_mes_destino_inicio
        and v_mes_destino_inicio < date_trunc('month', t.fecha) + (t.msi_meses || ' months')::interval
      )
    );

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
end;
$$;

revoke all on function public.copy_budget_month(text, text, boolean) from public;
grant execute on function public.copy_budget_month(text, text, boolean) to authenticated;

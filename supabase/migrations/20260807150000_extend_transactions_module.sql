-- Módulo Transacciones (CU-013) — docs/pdr/transacciones.md, docs/pdr/data-model-registry.md
--
-- Extiende el contrato mínimo de `transactions` (creado en 20260806192658 para el ajuste manual de
-- saldo, RN-020) con el esquema definitivo que pide CU-013 — registrar gasto/ingreso — sin romper
-- el `tipo = 'ajuste'` ya en uso. CU-014/CU-015/CU-016/CU-017/CU-018 (transferencias, pago a
-- tarjeta, listado, edición, eliminación) quedan fuera de este turno; el enum de `tipo` ya incluye
-- sus valores por completitud del modelo (evita otra migración de `tipo` cuando les toque), pero
-- solo `ajuste`, `gasto` e `ingreso` tienen un camino de escritura real hoy.

alter table public.transactions drop constraint transactions_tipo_check;
alter table public.transactions add constraint transactions_tipo_check
  check (tipo in ('ajuste', 'gasto', 'ingreso', 'transferencia', 'pago_tarjeta', 'aportacion_meta'));

alter table public.transactions
  add column category_id uuid references public.categories (id),
  add column transaccion_relacionada_id uuid references public.transactions (id) on delete cascade,
  add column nota text,
  add column updated_at timestamptz not null default now();

alter table public.transactions
  add constraint transactions_nota_length check (nota is null or char_length(nota) <= 140),
  -- RN-041/RN-047 (parcial): category_id solo aplica a gasto/ingreso; los demás tipos no lo llevan
  -- (transferencia/pago_tarjeta se resuelven en CU-014/CU-015, sin camino de escritura todavía).
  add constraint transactions_category_id_matches_tipo check (
    (tipo in ('gasto', 'ingreso') and category_id is not null) or
    (tipo not in ('gasto', 'ingreso') and category_id is null)
  );

comment on table public.transactions is
  'Movimientos financieros del usuario (CU-006 ajuste; CU-013 gasto/ingreso). CU-014/015/016/017/018 (transferencias, pago a tarjeta, listado, edición, eliminación) pendientes.';

-- CU-013 (reportes por categoría) / futura edición.
create index transactions_user_category_fecha_idx on public.transactions (user_id, category_id, fecha desc);
-- CU-014/CU-015 (futuro): localizar el documento enlazado de un movimiento de dos cuentas.
create index transactions_relacionada_idx on public.transactions (transaccion_relacionada_id)
  where transaccion_relacionada_id is not null;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CU-013 — Registrar gasto o ingreso (atómico: transacción + saldo de cuenta)
-- ---------------------------------------------------------------------------
-- Sin política de insert/update/delete para `authenticated` (mismo patrón que el contrato mínimo
-- original) — la única vía de escritura de gasto/ingreso es este RPC, que valida cuenta y
-- categoría, aplica el signo (RN-038) y actualiza `saldo_actual` en la misma operación (RN-040).
--
-- RN-039 identifica el grupo permitido por nombre (no hay columna estructural de "tipo de grupo"
-- en `categories` — ver docs/pdr/categorias.md, los grupos predefinidos se distinguen solo por
-- `nombre`): gasto admite Bills/Needs/Wants/Investment, ingreso solo Income.

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

  if p_tipo = 'gasto' and v_group.nombre not in ('Bills', 'Needs', 'Wants', 'Investment') then
    raise exception 'BIZ_009';
  end if;
  if p_tipo = 'ingreso' and v_group.nombre <> 'Income' then
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

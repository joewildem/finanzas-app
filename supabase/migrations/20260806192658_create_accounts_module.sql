-- Módulo Cuentas (CU-001 a CU-006) — docs/pdr/cuentas.md, docs/pdr/data-model-registry.md
--
-- Crea `accounts`, un contrato mínimo y provisional de `transactions` (RN-020 — el módulo
-- Transacciones lo extenderá cuando le toque su turno, sin romperlo), el bucket de Storage para
-- imágenes de cuenta, y el RPC que hace atómico el ajuste manual de saldo (CU-006).

-- ---------------------------------------------------------------------------
-- Tabla `accounts`
-- ---------------------------------------------------------------------------

create type public.account_type as enum ('debito', 'credito', 'efectivo');
create type public.account_status as enum ('active', 'archived');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nombre text not null,
  tipo public.account_type not null,
  saldo_inicial numeric(14, 2) not null default 0,
  saldo_actual numeric(14, 2) not null default 0,
  imagen_url text,
  color text not null default '#9CA3AF',
  excluir_de_stats boolean not null default false,
  linea_credito numeric(14, 2),
  dia_corte smallint,
  dia_pago smallint,
  gasto_minimo_mensual numeric(14, 2),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_nombre_length check (char_length(nombre) between 2 and 50),
  constraint accounts_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- RN-004 / VALIDATION_003: saldo inicial negativo solo permitido en cuentas de crédito.
  constraint accounts_saldo_inicial_sign check (tipo = 'credito' or saldo_inicial >= 0),
  constraint accounts_dia_corte_range check (dia_corte is null or dia_corte between 1 and 31),
  constraint accounts_dia_pago_range check (dia_pago is null or dia_pago between 1 and 31),
  constraint accounts_linea_credito_positive check (linea_credito is null or linea_credito > 0),
  constraint accounts_gasto_minimo_nonneg check (gasto_minimo_mensual is null or gasto_minimo_mensual >= 0),
  -- RN-010: línea de crédito, día de corte y día de pago son obligatorios solo si tipo=credito...
  constraint accounts_credito_fields_required check (
    tipo <> 'credito' or (linea_credito is not null and dia_corte is not null and dia_pago is not null)
  ),
  -- ...y no aplican (deben quedar null) para débito/efectivo.
  constraint accounts_credito_fields_null_otherwise check (
    tipo = 'credito' or (
      linea_credito is null and dia_corte is null and dia_pago is null and gasto_minimo_mensual is null
    )
  )
);

comment on table public.accounts is
  'Cuentas financieras del usuario (CU-001 a CU-006). Una fila por cuenta; el historial de ajustes vive en `transactions`.';

-- RN-001/RN-005: nombre único por usuario, sin distinguir mayúsculas/minúsculas.
create unique index accounts_user_nombre_key on public.accounts (user_id, lower(nombre));
-- CU-002/CU-005: listar cuentas activas/archivadas de un usuario.
create index accounts_user_status_idx on public.accounts (user_id, status);

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

-- RN-003: saldo_actual siempre se siembra desde saldo_inicial al crear, sin importar qué mande
-- el cliente en ese campo.
create or replace function public.accounts_seed_saldo_actual()
returns trigger
language plpgsql
as $$
begin
  new.saldo_actual := new.saldo_inicial;
  return new;
end;
$$;

create trigger accounts_seed_saldo_actual
before insert on public.accounts
for each row
execute function public.accounts_seed_saldo_actual();

-- RN-002/RN-006/RN-014: tipo, saldo_inicial y saldo_actual son inmutables después de creada la
-- cuenta. Sin backend propio, RLS por sí solo no puede expresar "esta columna es de solo lectura"
-- — se revoca a nivel de columna en vez de con un trigger, es el mecanismo nativo de Postgres para
-- esto. `status` queda fuera (CU-005 lo actualiza directo desde el cliente).
revoke update (saldo_inicial, saldo_actual, tipo) on public.accounts from authenticated;

-- ---------------------------------------------------------------------------
-- RLS — `accounts`
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;

create policy "accounts_select_own"
on public.accounts
for select
to authenticated
using (auth.uid() = user_id);

create policy "accounts_insert_own"
on public.accounts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "accounts_update_own"
on public.accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Sin política de delete: baja lógica únicamente (status=archived, CU-005), igual que `users`.

-- ---------------------------------------------------------------------------
-- Tabla `transactions` — contrato mínimo y provisional (RN-020, solo lo que pide CU-006)
-- ---------------------------------------------------------------------------
-- El esquema completo (categorías, transferencias, monto con signo, etc.) ya está documentado en
-- docs/pdr/transacciones.md pero se construye cuando le toque su turno al módulo Transacciones —
-- esta tabla solo implementa el contrato mínimo que Cuentas necesita para el ajuste manual de
-- saldo. `tipo` es texto + CHECK (no enum) a propósito: un CHECK se reemplaza con un simple
-- `alter table`, mientras que un enum de Postgres solo puede agregar valores, nunca quitarlos —
-- la herramienta equivocada para una columna explícitamente documentada como provisional.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  tipo text not null check (tipo in ('ajuste')),
  concepto text not null,
  monto numeric(14, 2) not null,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.transactions is
  'Contrato mínimo y provisional (RN-020, CU-006) — el módulo Transacciones lo extiende sin romperlo cuando le toque construirse.';

create index transactions_account_fecha_idx on public.transactions (account_id, fecha desc);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

-- Sin política de insert/update/delete para `authenticated` a propósito: la única vía de
-- escritura es el RPC `adjust_account_balance` (ver abajo), que corre como el dueño de la tabla y
-- por lo tanto no depende de RLS. Un policy de insert aquí permitiría fabricar transacciones
-- `ajuste` con cualquier `monto`, sin relación real con un cambio de saldo.

-- ---------------------------------------------------------------------------
-- CU-006 — Ajuste manual de saldo (atómico)
-- ---------------------------------------------------------------------------

create or replace function public.adjust_account_balance(p_account_id uuid, p_nuevo_saldo numeric)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_diff numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  -- `for update`: bloquea la fila hasta el commit, cerrando la ventana entre verificar `status`
  -- y actualizar `saldo_actual` frente a un archivado concurrente (CU-005).
  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  if not found then
    -- RN-008: mismo mensaje para "no existe" y "es de otro usuario" (mitigación IDOR).
    raise exception 'BIZ_002';
  end if;

  if v_account.status <> 'active' then
    raise exception 'BIZ_004';
  end if;

  v_diff := p_nuevo_saldo - v_account.saldo_actual;

  update public.accounts set saldo_actual = p_nuevo_saldo where id = p_account_id
  returning * into v_account;

  -- RN-015: concepto fijo "Ajuste manual", sin motivo capturado por el usuario.
  insert into public.transactions (user_id, account_id, tipo, concepto, monto, fecha)
  values (auth.uid(), p_account_id, 'ajuste', 'Ajuste manual', v_diff, now());

  return v_account;
end;
$$;

revoke all on function public.adjust_account_balance(uuid, numeric) from public;
grant execute on function public.adjust_account_balance(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage — imágenes de cuenta (CU-001, CU-004)
-- ---------------------------------------------------------------------------
-- Bucket público: la imagen es decorativa (ej. foto de la tarjeta), no información financiera
-- sensible — el costo de mantener URLs firmadas no se justifica aquí. Las escrituras sí quedan
-- restringidas al dueño vía convención de ruta `{user_id}/{account_id}/{archivo}`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-images', 'account-images', true, 5242880, array['image/jpeg', 'image/png']);

create policy "account_images_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'account-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "account_images_update_own"
on storage.objects
for update
to authenticated
using (bucket_id = 'account-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'account-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "account_images_delete_own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'account-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Módulo Categorías (CU-007 a CU-012) — docs/pdr/categorias.md, docs/pdr/data-model-registry.md
--
-- Crea `categories` (grupos + categorías en una sola tabla, distinguidos por `tipo`), el RPC que
-- hace atómico el archivado en cascada de un grupo (CU-012), y reemplaza el placeholder de
-- `seed_default_categories_for_user` (definido en la migración de auth) con la siembra real de
-- grupos y categorías predefinidos (RN-025, RN-030). No se edita la migración de auth — el hook ya
-- llama a esta función por nombre desde el primer login; `create or replace` es seguro de reaplicar.

-- ---------------------------------------------------------------------------
-- Tabla `categories`
-- ---------------------------------------------------------------------------

create type public.category_kind as enum ('grupo', 'categoria');
create type public.category_status as enum ('active', 'archived');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tipo public.category_kind not null,
  nombre text not null,
  grupo_id uuid references public.categories (id) on delete cascade,
  color text,
  icono text,
  status public.category_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_nombre_length check (char_length(nombre) between 2 and 30),
  constraint categories_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  -- RN-027: grupo_id obligatorio si tipo=categoria; null si tipo=grupo.
  constraint categories_grupo_id_matches_tipo check (
    (tipo = 'grupo' and grupo_id is null) or (tipo = 'categoria' and grupo_id is not null)
  ),
  -- RN-024: color solo aplica a grupo.
  constraint categories_color_only_grupo check (tipo = 'grupo' or color is null),
  -- RN-028: icono solo aplica a categoria.
  constraint categories_icono_only_categoria check (tipo = 'categoria' or icono is null)
);

comment on table public.categories is
  'Grupos y categorías del usuario (CU-007 a CU-012), en una sola tabla distinguida por `tipo`.';

-- RN-022: nombre único entre grupos del usuario, sin distinguir mayúsculas/minúsculas. Índice
-- parcial porque grupo_id es NULL en todas las filas de grupo, y los NULL nunca colisionan en un
-- índice único normal.
create unique index categories_user_grupo_nombre_key on public.categories (user_id, lower(nombre))
  where tipo = 'grupo';
-- RN-026: nombre único entre categorías del mismo grupo, por usuario.
create unique index categories_user_categoria_nombre_key
  on public.categories (user_id, grupo_id, lower(nombre)) where tipo = 'categoria';
-- CU-007/CU-009: listar grupos activos/archivados de un usuario.
create index categories_user_tipo_status_idx on public.categories (user_id, tipo, status);
-- CU-008/CU-009/CU-012: listar categorías de un grupo; también resuelve la cascada de archivado.
create index categories_user_grupo_status_idx on public.categories (user_id, grupo_id, status);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — `categories`
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;

create policy "categories_select_own"
on public.categories
for select
to authenticated
using (auth.uid() = user_id);

create policy "categories_insert_own"
on public.categories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "categories_update_own"
on public.categories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Sin política de delete: baja lógica únicamente (status=archived, CU-012), mismo patrón que
-- `accounts`/`users`.

-- ---------------------------------------------------------------------------
-- CU-012 — Archivar grupo con cascada (atómico)
-- ---------------------------------------------------------------------------
-- Archivar una categoría suelta, y reactivar un grupo o categoría, son cambios de status de una
-- sola fila sin cascada — se resuelven directo desde el cliente con un `update` guardado por
-- `.eq('status', ...)`, mismo patrón que `ArchiveAccountDialog` (cero filas afectadas -> BIZ_008
-- en el cliente). Archivar un GRUPO sí necesita atomicidad real entre varias filas (el grupo +
-- todas sus categorías activas), así que es el único caso que amerita un RPC.

create or replace function public.archive_category_group(p_group_id uuid)
returns public.categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.categories;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  select * into v_group from public.categories
  where id = p_group_id and user_id = auth.uid() and tipo = 'grupo'
  for update;

  if not found then
    -- RN-008-style: mismo mensaje para "no existe" y "es de otro usuario" (mitigación IDOR).
    raise exception 'BIZ_006';
  end if;

  if v_group.status <> 'active' then
    raise exception 'BIZ_008';
  end if;

  update public.categories set status = 'archived' where id = p_group_id
  returning * into v_group;

  -- RN-034: cascada — solo las categorías que estaban activas en el momento de archivar el grupo.
  update public.categories set status = 'archived'
  where grupo_id = p_group_id and user_id = v_group.user_id and status = 'active';

  return v_group;
end;
$$;

revoke all on function public.archive_category_group(uuid) from public;
grant execute on function public.archive_category_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RN-025, RN-030 — Siembra real de grupos y categorías predefinidos
-- ---------------------------------------------------------------------------
-- Reemplaza el placeholder no-op definido en 20260805202129_create_users_table_and_auth_hook.sql
-- (`create or replace`, no se toca esa migración). El hook de auth ya invoca esta función en el
-- primer login de cada usuario — no requiere ningún cambio ahí.
--
-- Nombres en inglés (la UI de la app es 100% inglés) — "Ingresos" se tradujo a "Income" y los
-- ejemplos de categoría ("Renta", "Suscripciones") a inglés al cerrar este módulo; ver el
-- changelog de docs/pdr/categorias.md.

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
  insert into public.categories (user_id, tipo, nombre, color, status)
  values (target_user_id, 'grupo', 'Bills', '#EF4444', 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Rent', v_group_id, 'home', 'active'),
    (target_user_id, 'categoria', 'Electricity', v_group_id, 'bolt', 'active'),
    (target_user_id, 'categoria', 'Internet', v_group_id, 'wifi', 'active'),
    (target_user_id, 'categoria', 'Phone', v_group_id, 'phone', 'active');

  -- Needs
  insert into public.categories (user_id, tipo, nombre, color, status)
  values (target_user_id, 'grupo', 'Needs', '#3B82F6', 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Groceries', v_group_id, 'cart', 'active'),
    (target_user_id, 'categoria', 'Transport', v_group_id, 'car', 'active'),
    (target_user_id, 'categoria', 'Health', v_group_id, 'heart', 'active');

  -- Wants
  insert into public.categories (user_id, tipo, nombre, color, status)
  values (target_user_id, 'grupo', 'Wants', '#A855F7', 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Dining Out', v_group_id, 'utensils', 'active'),
    (target_user_id, 'categoria', 'Entertainment', v_group_id, 'film', 'active'),
    (target_user_id, 'categoria', 'Subscriptions', v_group_id, 'repeat', 'active');

  -- Investment
  insert into public.categories (user_id, tipo, nombre, color, status)
  values (target_user_id, 'grupo', 'Investment', '#22C55E', 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Stocks', v_group_id, 'trend-up', 'active'),
    (target_user_id, 'categoria', 'Retirement', v_group_id, 'wallet', 'active');

  -- Income
  insert into public.categories (user_id, tipo, nombre, color, status)
  values (target_user_id, 'grupo', 'Income', '#14B8A6', 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Salary', v_group_id, 'wallet', 'active'),
    (target_user_id, 'categoria', 'Other Income', v_group_id, 'generic', 'active');
end;
$$;

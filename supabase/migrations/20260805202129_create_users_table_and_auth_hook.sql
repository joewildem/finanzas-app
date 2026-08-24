-- Módulo Autenticación (CU-032 a CU-034) — docs/pdr/auth.md, docs/pdr/data-model-registry.md
--
-- Crea la tabla `users` (allowlist de acceso) y el Custom Access Token Hook que la hace cumplir
-- en cada emisión/renovación de token (RN-098, RN-102). El alta de usuarios es 100% manual desde
-- el Supabase Dashboard (RN-099) — esta migración no crea ningún flujo de autoregistro.
--
-- Paso manual pendiente fuera de este archivo (no se puede hacer por SQL): habilitar este hook
-- en Authentication > Hooks > "Custom Access Token" del dashboard, apuntando a
-- public.custom_access_token_hook.

-- ---------------------------------------------------------------------------
-- Tabla `users`
-- ---------------------------------------------------------------------------

create type public.user_status as enum ('active', 'inactive');

create table public.users (
  -- `id` es nullable hasta el primer login (vincula con auth.users.id — CU-032, RN-101) y por
  -- eso no puede ser PRIMARY KEY (Postgres exige NOT NULL en la PK). Se modela como columna
  -- única con FK a auth.users; `correo` es la clave estable pre- y post-login.
  id uuid references auth.users (id) on delete cascade,
  correo text not null,
  nombre_para_mostrar text,
  status public.user_status not null default 'active',
  primer_login_completado boolean not null default false,
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Allowlist de acceso (CU-032). Alta 100% manual vía Supabase Dashboard (RN-099) — sin autoregistro ni panel propio.';

create unique index users_correo_key on public.users (correo);
create unique index users_id_key on public.users (id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — obligatorio: el frontend usa la Publishable key (RN-098)
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

-- Un usuario autenticado solo puede leer su propia fila.
create policy "users_select_own"
on public.users
for select
to authenticated
using (auth.uid() = id);

-- Sin políticas de insert/update/delete para authenticated/anon a propósito: el alta y la
-- desactivación son 100% administrativas (RN-099), directas en el dashboard con service_role
-- (que además bypassa RLS por diseño). Sin política = denegado por defecto con RLS activo.

-- El hook corre como `supabase_auth_admin`, que a diferencia de `service_role` NO bypassa RLS
-- en el schema public por defecto — necesita su propio acceso explícito.
grant usage on schema public to supabase_auth_admin;
grant select, update on public.users to supabase_auth_admin;

create policy "auth_admin_read_users"
on public.users
for select
to supabase_auth_admin
using (true);

create policy "auth_admin_update_users"
on public.users
for update
to supabase_auth_admin
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Siembra de categorías predefinidas (RN-100) — placeholder
-- ---------------------------------------------------------------------------
-- `categories` todavía no existe en Postgres (pendiente de traducción Mongo -> Postgres, ver
-- docs/pdr/data-model-registry.md). El hook ya queda integrado con esta función para no tener
-- que volver a tocar el hook cuando le toque su turno al módulo Categorías.

create or replace function public.seed_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- TODO(categorias): insertar grupos semilla (Bills, Needs, Wants, Investment, Ingresos)
  -- una vez que exista public.categories (RN-030, RN-100).
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook (RN-098, RN-100, RN-101, RN-102)
-- ---------------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id uuid := (event ->> 'user_id')::uuid;
  user_email text;
  app_user public.users;
  claims jsonb;
begin
  select email into user_email from auth.users where id = auth_user_id;

  select * into app_user from public.users where correo = user_email;

  -- RN-098 / RN-102: lista blanca por correo + status=active, verificada en CADA emisión de
  -- token (no solo en el primer login) — un usuario desactivado pierde el acceso de inmediato.
  if not found or app_user.status <> 'active' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 401,
        'message', 'AUTH_002'
      )
    );
  end if;

  if not app_user.primer_login_completado then
    -- RN-100 / RN-101: primer login — vincula id, marca primer_login_completado, siembra categorías.
    update public.users
    set id = auth_user_id,
        primer_login_completado = true,
        nombre_para_mostrar = coalesce(
          app_user.nombre_para_mostrar,
          (select coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
           from auth.users where id = auth_user_id)
        ),
        ultimo_acceso = now()
    where correo = user_email;

    perform public.seed_default_categories_for_user(auth_user_id);
  else
    update public.users
    set ultimo_acceso = now()
    where correo = user_email;
  end if;

  -- El contrato del Custom Access Token Hook espera únicamente { "claims": {...} } de vuelta en
  -- el camino exitoso — no el evento completo reempacado (eso es lo que causaba el
  -- "Error running hook": GoTrue no reconocía la forma de la respuesta).
  claims := event -> 'claims';
  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

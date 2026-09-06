-- ---------------------------------------------------------------------------
-- Módulo Suscripciones (CU-078 a CU-082)
--
-- Un tracker de suscripciones que vive dentro de la plataforma pero no se
-- relaciona con ningún otro módulo: no toca `transactions`, `budgets`,
-- `accounts` ni `categories`. Esa independencia está garantizada por el
-- esquema (una tabla sin llaves foráneas fuera de `users`), no por disciplina
-- al escribir consultas.
--
-- Dos consecuencias del diseño que conviene tener presentes:
--
--   * **No hay funciones RPC.** Crear o editar una suscripción no mueve el
--     saldo de nada, así que todo se resuelve con insert/update directos bajo
--     RLS — primer módulo del proyecto sin lógica en Postgres. Las reglas que
--     sí importan (qué días cae un cobro) son derivadas, no almacenadas.
--   * **Las ocurrencias de cobro no se persisten.** Se calculan al vuelo desde
--     `fecha_inicio`, `ciclo` y el corte, mismo criterio que el resto de la app
--     (RN-113 de metas, el calendario de MSI, los históricos del Dashboard).
--
-- `metodo_pago` guarda el **nombre** de la cuenta como texto, deliberadamente,
-- no una referencia a `accounts`: el formulario ofrece los nombres existentes
-- para no teclear, pero la suscripción no queda atada a la cuenta. Renombrar
-- una cuenta no actualiza las suscripciones, y es el precio aceptado de la
-- independencia entre módulos.
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nombre text not null,
  categoria text not null,
  -- Dominio del servicio ("netflix.com"). Alimenta el logo vía Brandfetch; es
  -- opcional, y sin él la card cae al avatar de inicial + color.
  sitio_web text,
  monto numeric(14,2) not null,
  ciclo text not null,
  fecha_inicio date not null,
  -- Fecha en que la suscripción deja de cobrar, conocida de antemano.
  fecha_fin date,
  -- Prueba gratuita: no cambia ningún cálculo, marca la card y la lista de
  -- próximos cobros para no olvidar cancelar antes del primer cargo.
  es_prueba boolean not null default false,
  metodo_pago text,
  nota text,
  status text not null default 'active',
  -- Corte por archivado. Junto con `fecha_fin` define hasta cuándo se generan
  -- ocurrencias: archivar en junio deja de contarla de julio en adelante, pero
  -- enero a junio la siguen mostrando. Sin esto, archivar borraría dinero que
  -- sí se pagó de las gráficas históricas.
  archivada_en date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_nombre_length check (char_length(nombre) between 2 and 50),
  constraint subscriptions_categoria_valid check (
    categoria in (
      'ai', 'education', 'entertainment', 'finance', 'fitness', 'gaming', 'music',
      'news', 'other', 'productivity', 'shopping', 'streaming', 'travel', 'utilities'
    )
  ),
  constraint subscriptions_monto_positive check (monto > 0),
  -- Seasonal quedó fuera por ambiguo (se sustituyó por quarterly) y fortnightly
  -- por no usarse. `one_time` no es una suscripción recurrente: produce una sola
  -- ocurrencia y queda fuera del promedio mensual normalizado.
  constraint subscriptions_ciclo_valid check (
    ciclo in ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'one_time')
  ),
  constraint subscriptions_fecha_fin_valid check (fecha_fin is null or fecha_fin >= fecha_inicio),
  constraint subscriptions_status_valid check (status in ('active', 'archived')),
  -- `archivada_en` existe exactamente cuando la suscripción está archivada:
  -- reactivar la limpia, y así el corte no sobrevive a la reactivación.
  constraint subscriptions_archivada_en_matches_status check (
    (status = 'archived' and archivada_en is not null)
    or (status = 'active' and archivada_en is null)
  ),
  constraint subscriptions_sitio_web_length check (sitio_web is null or char_length(sitio_web) <= 253),
  constraint subscriptions_metodo_pago_length check (metodo_pago is null or char_length(metodo_pago) <= 50),
  constraint subscriptions_nota_length check (nota is null or char_length(nota) <= 500)
);

-- Nombre único solo entre las activas — una archivada libera su nombre, mismo
-- criterio que `savings_goals` y `debts`.
create unique index subscriptions_user_nombre_active_key on public.subscriptions (user_id, nombre)
  where status = 'active';
create index subscriptions_user_status_idx on public.subscriptions (user_id, status);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);
create policy "subscriptions_insert_own" on public.subscriptions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sin política de delete: el módulo archiva, no borra — mismo criterio que
-- `savings_goals` y `debts`.

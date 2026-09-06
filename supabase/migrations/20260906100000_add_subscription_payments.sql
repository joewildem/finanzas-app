-- ---------------------------------------------------------------------------
-- Suscripciones: marcar un cobro como pagado (CU-083)
--
-- Hasta ahora el módulo era enteramente derivado: de `fecha_inicio` y `ciclo`
-- salía todo el calendario, y no había nada que el usuario capturara sobre un
-- cobro concreto. Marcar "ya la pagué" es el primer dato que la aplicación no
-- puede deducir, y por eso necesita tabla propia.
--
-- La llave es **la fecha del cobro**, no el mes. Una suscripción semanal tiene
-- cuatro cargos en un mes y marcarla como pagada "en septiembre" no diría cuál
-- de los cuatro. Con la fecha, la misma tabla sirve para todos los ciclos sin
-- casos especiales.
--
-- La presencia de la fila **es** el estado: existe = pagado. No hay booleano que
-- pueda quedar en `false` y ocupar espacio, y desmarcar es borrar — mismo
-- criterio que `msi_payments` con un monto nulo. Por eso, a diferencia de
-- `subscriptions`, esta tabla sí necesita política de `delete`.
--
-- No se guarda el monto: es el de la suscripción en el momento de consultar. Si
-- el usuario corrige el precio, los pagos ya marcados reflejan el precio nuevo.
-- Es coherente con el resto del módulo, donde nada del pasado está congelado.
-- ---------------------------------------------------------------------------

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Sin la suscripción, sus pagos no significan nada.
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscription_payments_user_sub_fecha_key
  on public.subscription_payments (user_id, subscription_id, fecha);
create index subscription_payments_user_fecha_idx
  on public.subscription_payments (user_id, fecha);

create trigger subscription_payments_set_updated_at
before update on public.subscription_payments
for each row execute function public.set_updated_at();

alter table public.subscription_payments enable row level security;

create policy "subscription_payments_select_own" on public.subscription_payments for select to authenticated
  using (auth.uid() = user_id);
create policy "subscription_payments_insert_own" on public.subscription_payments for insert to authenticated
  with check (auth.uid() = user_id);
create policy "subscription_payments_delete_own" on public.subscription_payments for delete to authenticated
  using (auth.uid() = user_id);

-- Semilla del ambiente local (`supabase start` / `supabase db reset`) — NO se aplica jamás en
-- producción: este archivo solo lo corre el CLI de Supabase contra la base en Docker.
-- Ver docs/desarrollo/ambiente-local.md.
--
-- Contiene dos cosas:
--   1. La identidad de pruebas, con un UUID fijo. Se crea directamente en `auth.users` (en vez de
--      dejar que la cree el alta desde la aplicación) porque todas las tablas del dominio cuelgan de
--      `public.users.id`: sin un id conocido de antemano no se pueden sembrar datos de ejemplo.
--   2. Datos de ejemplo — grupos y categorías, cuentas, tarjetas de crédito, metas de ahorro y una
--      deuda — para que tras un `db reset` la aplicación quede lista para probar sin capturar nada
--      a mano.
--
-- Credenciales locales: dev@localhost.test / localdev123.
-- No son secretas ni sirven fuera de esta máquina: la base vive en Docker y no se expone a la red.

-- ---------------------------------------------------------------------------
-- 1. Identidad de pruebas
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'dev@localhost.test',
  extensions.crypt('localdev123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev Local"}'::jsonb,
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"dev@localhost.test","email_verified":true}'::jsonb,
  'email', now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- Allowlist de acceso (RN-099). Sin esta fila el Custom Access Token Hook rechaza la emisión del
-- token con AUTH_002, igual que en producción — que es justo el comportamiento que se quiere probar.
-- Se deja ya vinculada (`id` + `primer_login_completado`) para que los datos de ejemplo de abajo
-- puedan referenciar al usuario sin depender de que alguien inicie sesión primero.
insert into public.users (id, correo, nombre_para_mostrar, status, primer_login_completado)
values (
  '11111111-1111-4111-8111-111111111111',
  'dev@localhost.test',
  'Dev Local',
  'active',
  true
)
on conflict (correo) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Datos de ejemplo
-- ---------------------------------------------------------------------------

do $$
declare
  v_user constant uuid := '11111111-1111-4111-8111-111111111111';
  g_income uuid;
  g_bills uuid;
  g_needs uuid;
  g_wants uuid;
  g_investment uuid;
begin
  -- Idempotente: si ya hay categorías del usuario, la semilla ya corrió y no se duplica nada.
  if exists (select 1 from public.categories where user_id = v_user) then
    return;
  end if;

  -- Grupos (RN-118: el flujo es estructural, y `orden` fija su posición en Presupuesto).
  insert into public.categories (user_id, tipo, nombre, flujo, orden, color)
  values (v_user, 'grupo', 'Income', 'inflow', 1, '#22C55E') returning id into g_income;
  insert into public.categories (user_id, tipo, nombre, flujo, orden, color)
  values (v_user, 'grupo', 'Bills', 'outflow', 2, '#EF4444') returning id into g_bills;
  insert into public.categories (user_id, tipo, nombre, flujo, orden, color)
  values (v_user, 'grupo', 'Needs', 'outflow', 3, '#F59E0B') returning id into g_needs;
  insert into public.categories (user_id, tipo, nombre, flujo, orden, color)
  values (v_user, 'grupo', 'Wants', 'outflow', 4, '#8B5CF6') returning id into g_wants;
  insert into public.categories (user_id, tipo, nombre, flujo, orden, color)
  values (v_user, 'grupo', 'Investment', 'investment', 5, '#3B82F6') returning id into g_investment;

  -- Categorías (los `icono` son claves del catálogo de src/lib/category-icons.ts).
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono)
  values
    (v_user, 'categoria', 'Salary',        g_income,     'wallet'),
    (v_user, 'categoria', 'Freelance',     g_income,     'briefcase'),
    (v_user, 'categoria', 'Rent',          g_bills,      'home'),
    (v_user, 'categoria', 'Utilities',     g_bills,      'bolt'),
    (v_user, 'categoria', 'Internet',      g_bills,      'wifi'),
    (v_user, 'categoria', 'Groceries',     g_needs,      'cart'),
    (v_user, 'categoria', 'Transport',     g_needs,      'car'),
    (v_user, 'categoria', 'Health',        g_needs,      'hospital'),
    (v_user, 'categoria', 'Dining out',    g_wants,      'utensils'),
    (v_user, 'categoria', 'Shopping',      g_wants,      'shoppingbag'),
    (v_user, 'categoria', 'Entertainment', g_wants,      'film'),
    (v_user, 'categoria', 'Brokerage',     g_investment, 'trend-up'),
    (v_user, 'categoria', 'Retirement',    g_investment, 'piggybank');

  -- Cuentas. Las de débito/efectivo arrancan con saldo inicial igual al actual (no hay movimientos
  -- todavía, así que cualquier otra cosa dejaría el histórico inconsistente con el saldo vigente).
  insert into public.accounts (user_id, nombre, tipo, saldo_inicial, saldo_actual, color)
  values
    (v_user, 'Cuenta de Nómina', 'debito',   45000.00, 45000.00, '#0EA5E9'),
    (v_user, 'Efectivo',         'efectivo',  3000.00,  3000.00, '#84CC16');

  -- Tarjetas de crédito: arrancan en cero para que la deuda se construya con los gastos que se
  -- registren al probar (incluidos los de meses sin intereses). `saldo_actual` de una tarjeta es la
  -- deuda en positivo — ver la migración 20260901100000.
  insert into public.accounts (
    user_id, nombre, tipo, saldo_inicial, saldo_actual, color,
    linea_credito, dia_corte, dia_pago, gasto_minimo_mensual
  )
  values
    (v_user, 'Tarjeta Joy',     'credito', 0, 0, '#EC4899', 94500.00, 15,  5, 6000.00),
    (v_user, 'Tarjeta Platino', 'credito', 0, 0, '#64748B', 50000.00, 20, 10, null);

  -- Metas de ahorro (`fecha_limite` debe ser hoy o futura, de ahí el cálculo relativo).
  insert into public.savings_goals (user_id, nombre, emoji, monto_objetivo, monto_inicial, fecha_limite)
  values
    (v_user, 'Fondo de emergencia', '🛟', 100000.00, 25000.00, null),
    (v_user, 'Viaje a Japón',       '✈️',  60000.00, 12000.00, current_date + 300);

  -- Una deuda activa: en Presupuesto, el grupo "Debts" es el patrón que replica el grupo nuevo
  -- "Installments (MSI)" — tenerlos lado a lado hace evidente si el diseño quedó consistente.
  insert into public.debts (user_id, nombre, tipo, monto_original, tasa_interes, pago_mensual_esperado, dia_pago)
  values (v_user, 'Suzuki Baleno 2026', 'auto', 280000.00, 11.50, 6200.00, 12);
end $$;

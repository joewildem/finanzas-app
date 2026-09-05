---
status: vigente
last-updated: 2026-09-03
---

# Ambiente local de pruebas

Stack completo de Supabase corriendo en Docker sobre la máquina de desarrollo, con su propia base de
datos, su propio Auth y su propio Studio. Permite registrar movimientos de prueba, correr migraciones
nuevas y romper cosas sin tocar la base de producción (la que sirve al dominio público).

Hasta el 2026-09-03 el proyecto no tenía separación: la aplicación desplegada y el trabajo de
desarrollo apuntaban al mismo proyecto de Supabase, así que cualquier prueba escribía sobre datos
financieros reales.

## Prerrequisitos

- **Docker Desktop instalado y corriendo.** El stack local son varios contenedores (Postgres, Auth,
  Studio, Storage). Si Docker no está arriba, `supabase start` falla de inmediato.
- El CLI de Supabase ya está como `devDependency` — se invoca con `npx supabase ...`, sin instalación
  global.

## Puesta en marcha (una sola vez)

1. Abrir Docker Desktop y esperar a que el motor quede listo.
2. Levantar el stack. La primera corrida descarga varias imágenes y puede tardar varios minutos:

   ```bash
   npx supabase start
   ```

   Al terminar imprime las credenciales locales. Se pueden volver a consultar cuando sea con
   `npx supabase status`.

3. Crear `.env.development.local` en la raíz del repositorio con los valores que imprimió el paso
   anterior:

   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<"publishable key" o, si el CLI no la imprime, "anon key">
   ```

   Vite carga `.env.development.local` **solo** en modo desarrollo (`npm run dev`). El build de
   producción (`npm run build`) lee `.env.local`, que conserva las credenciales de producción — por
   eso el ambiente local no puede filtrarse al despliegue. El archivo ya queda ignorado por
   `.gitignore` (`.env.*`).

4. Arrancar la aplicación:

   ```bash
   npm run dev
   ```

## Uso diario

- `npx supabase start` / `npx supabase stop` levantan y bajan el stack. Los datos sobreviven entre
  arranques: `stop` no borra nada.
- La aplicación queda en `http://localhost:5173`, y el Studio de la base local en
  `http://127.0.0.1:54323` (útil para inspeccionar tablas o insertar datos a mano).
- Si el puerto 5173 está ocupado, Vite toma el siguiente libre (5174, 5175…) y lo anuncia al
  arrancar. Eso no rompe el ingreso local: el bloque de correo/contraseña llama a la API de Auth
  directamente, sin el redirect de vuelta que sí usa OAuth, así que no depende de que el puerto
  coincida con `additional_redirect_urls` de `config.toml`.

### Ingreso

En producción el único acceso es Google (CU-032). El stack local no tiene OAuth de Google
configurado, así que el login muestra un bloque adicional de correo/contraseña visible **solo** en
desarrollo: va detrás de `import.meta.env.DEV`, que Vite sustituye por `false` al compilar, de modo
que desaparece por completo del bundle publicado.

Credenciales locales: `dev@localhost.test` / `localdev123`. El botón "Sign in locally" inicia sesión
y, si el usuario todavía no existe (base recién creada), lo da de alta en el momento.

El control de acceso sigue siendo el mismo que en producción: el Custom Access Token Hook
(RN-098/RN-102) valida el correo contra el allowlist de `public.users`. Esa fila la inserta
`supabase/seed.sql`; un correo fuera de la lista recibe `AUTH_002` igual que en producción.

### Datos

La base local nace vacía — sin cuentas, sin categorías, sin movimientos. Se poblan a mano desde la
aplicación en la primera corrida y persisten de ahí en adelante. No se copian datos de producción:
son cifras financieras reales y el propósito del ambiente es justamente no depender de ellas.

## Migraciones

Con ambiente local, el flujo de una migración nueva pasa a ser:

1. Escribir el archivo en `supabase/migrations/`.
2. Aplicarla localmente y verificarla: `npx supabase migration up` (aplica las pendientes) o
   `npx supabase db reset` (borra la base local, replica todas las migraciones desde cero y vuelve a
   correr `seed.sql` — la forma más fiel de comprobar que la migración funciona en una base limpia).
3. Ya validada, correrla en producción **manualmente** desde el SQL Editor de Supabase, como
   siempre. Esa parte no cambia: producción nunca se migra de forma automática.

`npx supabase db reset` es destructivo **solo** en local. Nunca toca producción.

## Límites conocidos

- El flujo real de OAuth con Google no se ejercita localmente. Es código estable y aislado
  (`login-page.tsx` + `auth-callback-page.tsx`); cualquier cambio ahí se sigue verificando contra
  producción.
- El stack local consume memoria mientras está arriba. Conviene `npx supabase stop` al terminar.

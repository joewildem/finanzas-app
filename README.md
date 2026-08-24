# Finanzas App

App de finanzas personales — MVP cerrado para un grupo reducido de usuarios (<5), con web app y app híbrida (iOS/Android).

## 📖 Documentación

Toda la documentación del producto (discovery, estrategia, requerimientos, flujos, roadmap) vive en [`/docs`](./docs) y está pensada para abrirse como vault de Obsidian.

👉 Empieza en [`docs/00-Home.md`](finanzas-app-hub.md)

## Estructura

- `docs/discovery` — problem statement, personas
- `docs/strategy` — visión, diferenciadores, alcance
- `docs/design` — brief UX, user flows, wireframes
- `docs/prd` — requerimientos funcionales detallados, por módulo
- `docs/roadmap` — plan de trabajo
- `docs/backlog` — funcionalidades pospuestas
- `docs/templates` — plantillas para nuevos documentos

## Deploy (Cloudflare Workers — static assets)

Versiones de prueba únicamente — todavía falta Dashboard, logo y favicon definitivos.

Se despliega como un Worker "solo-assets" (sin código de servidor), configurado en `wrangler.jsonc`.
Al conectar el repo en el dashboard de Cloudflare (Workers & Pages → Create → Connect to Git), esos
son los campos que importan:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy` (default de Cloudflare, no cambiar)
- **Variables de entorno** (sección "Variables and Secrets" del proyecto en Cloudflare, no se
  commitean): agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como **variables de
  build sin encriptar** (ver `.env.example`) — Vite las necesita disponibles durante `npm run build`,
  no en runtime, así que si se guardan como "secret" encriptado puede que el build no las vea.
  `SUPABASE_SECRET_KEY` nunca va aquí — solo se usa localmente/CLI.
- `wrangler.jsonc` → `assets.not_found_handling: "single-page-application"` sirve `index.html` para
  cualquier ruta no encontrada (necesario para que las rutas de React Router, ej.
  `/settings/accounts`, funcionen al recargar o entrar directo por URL).
- Una vez desplegado, agregar el subdominio propio en el proyecto de Cloudflare (pestaña "Domains").
- En Supabase (Authentication → URL Configuration) agregar ese subdominio a **Site URL** /
  **Redirect URLs**, o el login con Google fallará después del deploy.

`public/_redirects` queda en el repo mas no aplica a este flujo (es una convención específica de
Cloudflare Pages clásico, no de Workers) — se puede ignorar mientras el deploy sea vía Workers.


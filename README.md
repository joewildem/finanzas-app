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

## Deploy (Cloudflare Pages)

Versiones de prueba únicamente — todavía falta Dashboard, logo y favicon definitivos.

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Variables de entorno** (Settings → Environment variables del proyecto en Cloudflare Pages, no se commitean): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`). `SUPABASE_SECRET_KEY` nunca va aquí — solo se usa localmente/CLI.
- `public/_redirects` ya enruta cualquier ruta a `index.html` (necesario para que las rutas de React Router, ej. `/settings/accounts`, funcionen al recargar o entrar directo por URL).
- En Supabase (Authentication → URL Configuration) agregar el subdominio de Cloudflare a **Site URL** / **Redirect URLs**, o el login con Google fallará después del deploy.


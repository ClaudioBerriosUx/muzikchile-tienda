# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Regla de sesión

**Al iniciar sesión, lee PROGRESS.md para retomar el estado.**
**Al cerrar, actualiza PROGRESS.md con lo hecho, lo que sigue y los pendientes.**

## Comandos

```bash
npm run dev      # dev server → localhost:3000
npm run build    # build de producción
npm run lint     # ESLint
npx tsc --noEmit # type-check (no hay tests)
```

## Variables de entorno

Copia `.env.example` → `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — credenciales públicas de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — solo en Route Handlers (bypassa RLS)
- `NEXT_PUBLIC_URL` — URL base para los `back_urls` de MercadoPago (ej. `http://localhost:3000`)

## Arquitectura general

**MuzikChile Tienda** es un marketplace de merch para artistas chilenos. Stack: Next.js 16 App Router, React 19, Supabase (auth + DB + storage), MercadoPago, Tailwind v4, Zustand, React Query.

### Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | público | Catálogo con filtros (categoría, región, tipo, orden, búsqueda) |
| `/producto/[id]` | público | Ficha de producto |
| `/artista/[slug]` | público | Tienda del artista |
| `/carrito` | público | Carrito |
| `/checkout` | público | Formulario + MercadoPago |
| `/checkout/exito|error|pendiente` | público | Resultado del pago |
| `/login`, `/registro` | público | Auth |
| `/panel/**` | rol: `artista` | Dashboard del artista |
| `/admin/**` | rol: `admin` | Panel de administración |

### Auth y roles

Roles en tabla `user_roles` (`role` = `"artista"` | `"admin"`). Los layouts de `/panel` y `/admin` usan **guards client-side** (`"use client"` + `useEffect`) — no hay protección en middleware, solo refresco de cookies de sesión en `lib/supabase/middleware.ts`.

Primer login vía magic link sin rol → el layout asigna `artista` automáticamente y crea registro en `artistas`.

### Clientes Supabase

- `lib/supabase/client.ts` — browser (`createBrowserClient`), para Client Components
- `lib/supabase/server.ts` — async server (`createServerClient` + cookies), para Server Components y Route Handlers
- Route Handlers que bypasean RLS usan `createClient` de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY` directamente

### Estado

- **Carrito**: Zustand + `persist` → localStorage como `muzikchile-carrito`
- **Server state**: React Query en `<Providers>` (`components/providers.tsx`), `staleTime: 60s`

### Tablas DB relevantes (inferidas de queries)

`artistas`, `productos` (estados: `en_revision` → `aprobado`), `ordenes`, `categorias`, `cupones`, `user_roles`, `app_settings` (tokens de MercadoPago y modo sandbox/prod), `liquidaciones`

### Flujo de pago

`POST /api/mercadopago/crear-preferencia`:
1. Lee `mp_access_token` y `mp_modo` de `app_settings`
2. Aplica descuento por cupón si se envía `cupon_id`
3. Obtiene comisión por artista (`artistas.comision`; founders: 0%)
4. Crea preferencia en MercadoPago
5. Inserta filas en `ordenes` (estado `pendiente`, una por item)
6. Retorna `init_point` / `sandbox_init_point`

No hay webhook para actualizar estado de órdenes post-pago (verificar si existe en Supabase Edge Functions).

### Convenciones de estilo

Tailwind v4 (breaking changes desde v3 — leer `node_modules/next/dist/docs/` antes de asumir APIs v3).

- Headings: `font-family: Oswald` | Body: `font-family: Barlow` — vía `style={{}}` inline, no clases Tailwind
- Color marca: `#e8003d` | Fondo: `#f8f7f5`
- Inline styles y Tailwind coexisten intencionalmente
- Imágenes en Supabase Storage; host whitelisted en `next.config.ts`
- `export const dynamic = 'force-dynamic'` necesario en páginas con `useSearchParams` o para evitar SSG en Vercel

### Utilidades

- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- `lib/constants.ts` — `COLORES_ACENTO`, `REGIONES_CHILE`, `BANCOS_CHILE`, `formatCLP()`

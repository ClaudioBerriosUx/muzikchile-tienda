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

### Estructura de carpetas del App Router

Las rutas públicas viven en el route group **`app/(publico)/`**, cuyo `layout.tsx`
monta `Header` + `Footer` una sola vez. Los paréntesis no aparecen en la URL:
`app/(publico)/carrito/page.tsx` sirve `/carrito`.

```
app/
├─ (publico)/          → layout con Header + Footer
│  ├─ page.tsx         → /
│  ├─ producto/[id]/   artista/[slug]/   carrito/
│  ├─ checkout/        (+ exito, error, pendiente)
│  └─ login/  registro/  recuperar/
├─ panel/              → layout propio (Header + Sidebar), rol artista
├─ admin/              → layout propio (Header + Sidebar), rol admin
├─ api/                → Route Handlers
├─ layout.tsx          → root: fuentes, Providers, Toaster, noindex global
├─ robots.ts  sitemap.ts
└─ not-found.tsx  error.tsx  loading.tsx
```

**Al agregar una ruta pública nueva, va dentro de `(publico)/`** — así hereda
Header y Footer. No importes `<Header/>` a mano en una página.

### Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | público | Catálogo con filtros (categoría, región, tipo, orden, búsqueda) |
| `/producto/[id]` | público | Ficha de producto |
| `/artista/[slug]` | público | Ficha del artista (SSR con `generateMetadata`) |
| `/carrito` | público | Carrito |
| `/checkout` | público | Formulario + MercadoPago |
| `/checkout/exito|error|pendiente` | público | Resultado del pago |
| `/login`, `/registro`, `/recuperar` | público | Auth (registro = set-password tras invitación) |
| `/panel/**` | rol: `artista` | Dashboard del artista |
| `/admin/**` | rol: `admin` | Panel de administración |

El menú del Header ya enlaza `/noticias`, `/convocatorias`, `/artistas` y
`/tienda`, que **todavía no existen** (dan 404). Se crean en la reestructuración
a plataforma de comunidad.

### Auth y roles

Roles en tabla `user_roles` (`role` = `"artista"` | `"admin"`). Hay **dos capas**:

1. **`proxy.ts`** (raíz del repo — Next 16 renombró middleware → proxy): redirige
   a `/login?redirectTo=...` si no hay sesión en `/panel` o `/admin`. Solo mira
   sesión, **no conoce roles**. Su matcher cubre todo el sitio para refrescar las
   cookies de Supabase.
2. **Guards client-side** en `app/panel/PanelShell.tsx` y `app/admin/AdminShell.tsx`:
   consultan `user_roles` y redirigen según el rol.

⚠️ Los guards de rol corren en el cliente, después de hidratar. **La protección
real de los datos es RLS en Supabase**, no el layout. Cualquier regla de acceso
nueva va en RLS o en un Route Handler, nunca solo en el guard.

Los layouts de `/panel` y `/admin` son Server Components delgados (exportan
`metadata` con `noindex` y `dynamic`) que renderizan su Shell cliente. Un Client
Component no puede exportar `metadata`; por eso está partido así.

`lib/supabase/middleware.ts` es **código muerto**: nadie lo importa, `proxy.ts`
lo reemplazó.

Primer login vía magic link sin rol → `PanelShell` asigna `artista`
automáticamente y crea el registro en `artistas`.

### Clientes Supabase

- `lib/supabase/client.ts` — browser (`createBrowserClient`), para Client Components
- `lib/supabase/server.ts` — async server (`createServerClient` + cookies), para Server Components y Route Handlers
- Route Handlers que bypasean RLS usan `createClient` de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY` directamente

### Estado

- **Carrito**: Zustand + `persist` → localStorage como `muzikchile-carrito`
- **Server state**: React Query en `<Providers>` (`components/providers.tsx`), `staleTime: 60s`

### Esquema de base de datos

Tablas: `artistas`, `productos` (estados: `en_revision` → `aprobado`), `ordenes`,
`categorias`, `cupones`, `user_roles`, `app_settings` (tokens de MercadoPago y
modo sandbox/prod), `liquidaciones`.

**La fuente de verdad del esquema es `lib/supabase/types.ts`** (generado), no los
queries. Los clientes de `lib/supabase/{client,server}.ts` están tipados con
`Database`, así que una columna inexistente es error de compilación.

#### Regla: todo cambio de esquema va por migración versionada

```bash
npx supabase migration new descripcion_del_cambio   # 1. crear
#                                                     2. escribir el SQL
npx supabase db push                                # 3. aplicar
npx supabase gen types typescript --linked > lib/supabase/types.ts   # 4. regenerar
```

**El paso 4 no es opcional, y va en el mismo commit que la migración.** Nada de
tocar el esquema desde el editor SQL del dashboard sin reflejarlo en una
migración. Ver `supabase/README-migraciones.md`.

`supabase/migrations/` contiene **solo** archivos `<timestamp>_nombre.sql`:
cualquier otra cosa ahí hace que el CLI emita un warning de "Skipping migration"
en cada `db push`.

⚠️ **Nunca uses `as` / `as unknown as` sobre el resultado de un `.select()`**: el
cast anula la validación de columnas y es exactamente cómo se colaron los tres
bugs de nombres de columna del proyecto (`cupones.tipo`, `liquidaciones.fecha`,
`artistas.redes_sociales`). Si necesitas un tipo, derívalo:

```ts
type Cupon = Database["public"]["Tables"]["cupones"]["Row"];
```

### Flujo de pago

`POST /api/mercadopago/crear-preferencia`:
1. Lee `mp_access_token` y `mp_modo` de `app_settings`
2. Aplica descuento por cupón si se envía `cupon_id`
3. Obtiene comisión por artista (`artistas.comision`; founders: 0%)
4. Crea preferencia en MercadoPago
5. Inserta filas en `ordenes` (estado `pendiente`, una por item)
6. Retorna `init_point` / `sandbox_init_point`

`POST /api/mercadopago/webhook` recibe el IPN, consulta el pago en MP, actualiza
`ordenes` a `pagado`/`cancelado`, incrementa los usos del cupón y descuenta stock
de productos físicos. La `notification_url` solo se envía a MP cuando
`NEXT_PUBLIC_URL` es HTTPS (en local, MP la rechaza).

### Convenciones de estilo

Tailwind v4 (breaking changes desde v3 — leer `node_modules/next/dist/docs/` antes de asumir APIs v3).

- Headings: `font-family: Oswald` | Body: `font-family: Barlow` — vía `style={{}}` inline, no clases Tailwind
- Color marca: `#e8003d` | Fondo: `#f8f7f5`
- Inline styles y Tailwind coexisten intencionalmente
- Imágenes en Supabase Storage; host whitelisted en `next.config.ts`
- `export const dynamic = 'force-dynamic'` necesario en páginas con `useSearchParams` o para evitar SSG en Vercel

### SEO

El sitio está **fuera de los buscadores a propósito** mientras se construye, con
dos bloqueos independientes:

1. `app/layout.tsx` → `robots: { index: false }` global.
2. `public/robots.txt` → `Disallow: /`.

⚠️ **Los dos son deliberados y se quitan SOLO en el lanzamiento** (ver Plan
MuzikChile 2.0). Y hay que quitar **los dos**: sacar solo uno deja el sitio
bloqueado igual. Como los estáticos de `public/` tienen precedencia sobre las
rutas del App Router, mientras `public/robots.txt` exista **`app/robots.ts` no se
sirve** — está escrito y probado, pero eclipsado.

La infraestructura ya está lista para ese día:
- `/panel`, `/admin`, `/checkout`, `/carrito`, `/login`, `/registro` y
  `/recuperar` declaran su propio `noindex` en sus layouts, así que **al quitar
  el global no quedan expuestas**.
- `app/robots.ts` — permite todo salvo `/panel`, `/admin`, `/api`.
- `app/sitemap.ts` — home, `/tienda` y las fichas `/artista/[slug]` de artistas
  con `tienda_activa` o `verificado`. Revalida cada hora.

Un `Disallow` en robots.txt **no** es un `noindex`: una URL bloqueada puede
indexarse igual si alguien la enlaza. Por eso las rutas privadas llevan las dos
cosas.

### Utilidades

- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- `lib/constants.ts` — `COLORES_ACENTO`, `REGIONES_CHILE`, `BANCOS_CHILE`, `formatCLP()`
- `lib/imagen.ts` — `comprimirImagen(archivo, maxWidth, calidad)`: redimensiona y
  reencoda a JPEG en el navegador antes de subir a Storage. **Úsala en vez de
  reescribirla**; estuvo duplicada en `panel/perfil` (400px) y
  `panel/productos/nuevo` (800px). Nunca rechaza: ante error devuelve el original.
- `lib/site.ts` — `BASE_URL` (desde `NEXT_PUBLIC_URL`), para robots y sitemap
- `components/layout/nav-links.ts` — `NAV_LINKS` y `ACCESO_ARTISTAS_HREF`,
  compartidos por Header y Footer para que no se desincronicen

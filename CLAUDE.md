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
  y la `redirect_uri` del OAuth de MP: en producción tiene que ser exactamente
  `https://www.muzikchile.cl` (la registrada en la aplicación de MP)
- `MP_CLIENT_ID` / `MP_CLIENT_SECRET` — aplicación de MP del marketplace (OAuth)
- `MP_TOKENS_KEY` — llave AES-256 (32 bytes base64) que cifra los tokens de los
  artistas; si cambia, todas las cuentas tienen que reconectarse
- `CRON_SECRET` — lo manda Vercel al cron `/api/cron/mp-renovar` (`vercel.json`)
- `MP_WEBHOOK_SECRET` — clave secreta de los webhooks de MP (una o varias separadas
  por coma). Solo en Production. Nunca va al log: `lib/mp/firma.ts` anota solo
  qué clave coincidió, por posición.

## Arquitectura general

**MuzikChile Tienda** es un marketplace de merch para artistas chilenos. Stack: Next.js 16 App Router, React 19, Supabase (auth + DB + storage), MercadoPago, Tailwind v4, Zustand, React Query.

### Estructura de carpetas del App Router

Las rutas públicas viven en el route group **`app/(publico)/`**, cuyo `layout.tsx`
monta `Header` + `Footer` una sola vez. Los paréntesis no aparecen en la URL:
`app/(publico)/carrito/page.tsx` sirve `/carrito`.

```
app/
├─ (publico)/          → layout con Header + Footer
│  ├─ page.tsx         → / (portada; islas cliente en _portada/)
│  ├─ tienda/          noticias/ (+ [slug])   privacidad/
│  ├─ producto/[id]/   artista/[slug]/   carrito/
│  ├─ checkout/        (+ exito, error, pendiente)
│  └─ login/  registro/  recuperar/
├─ panel/              → layout propio (HeaderPanel + Sidebar), rol artista
├─ admin/              → layout propio (HeaderPanel + Sidebar), rol admin
├─ api/                → Route Handlers
├─ layout.tsx          → root: fuentes, Providers, Toaster, noindex global
├─ robots.ts  sitemap.ts
└─ not-found.tsx  error.tsx  loading.tsx
```

**Al agregar una ruta pública nueva, va dentro de `(publico)/`** — así hereda
Header y Footer. No importes `<Header/>` a mano en una página.

**Dos headers:**
- `components/layout/Header.tsx` — el público: cápsula flotante de vidrio,
  sticky. Ocupa `--alto-header` (62px) en el flujo y, pegada arriba, tapa hasta
  `--header-ocupa` (76px). Todo lo que dependa del alto (un `min-h` de "pantalla
  menos header", un `sticky top-…`) usa esas variables de `globals.css`, nunca
  un número a mano. `<html>` tiene `scroll-padding-top: var(--header-ocupa)`.
  El primer elemento de una página (la miga de pan) usa
  `pt-(--aire-bajo-header)` para quedar 16px bajo la cápsula.
- `components/layout/HeaderPanel.tsx` — el de /panel y /admin, clásico de 64px.
  `Sidebar` depende de esos 64px (`top-16`, `calc(100vh - 64px)`).

### Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | público | Portada: hero con la señal en vivo, videos destacados, últimas noticias |
| `/tienda` | público | Catálogo con filtros (categoría, región, tipo, orden, búsqueda) |
| `/noticias`, `/noticias/[slug]` | público | Feed de publicaciones y nota individual |
| `/privacidad` | público | Política de privacidad (borrador, pendiente revisión legal) |
| `/producto/[id]` | público | Ficha de producto |
| `/artista/[slug]` | público | Ficha del artista (SSR con `generateMetadata`) |
| `/carrito` | público | Carrito |
| `/checkout` | público | Formulario + MercadoPago |
| `/checkout/exito|error|pendiente` | público | Resultado del pago |
| `/contacto` | público | Correo de contacto |
| `/login`, `/registro`, `/recuperar` | público | Auth (registro = set-password tras invitación o recuperación) |
| `/panel/**` | rol: `artista` | Dashboard del artista |
| `/panel/cobros` | rol: `artista` | Conectar/desconectar su cuenta de Mercado Pago (marketplace) |
| `/panel/despacho` | rol: `artista` | Pedidos pagados/enviados con nombre, email y dirección del comprador. RLS (`artista_lee_sus_ordenes_pagadas`): el artista solo lee órdenes pagado/enviado/entregado/reembolsado |
| `/admin/**` | rol: `admin` | Panel de administración |

`/contacto` es una página simple con `CORREO_CONTACTO` (`lib/site.ts`).
`/convocatorias`, `/artistas`, `/terminos` y `/despachos` **no existen** y se
sacaron del Header y el Footer; al crearlas, se vuelven a enlazar.

### Dominio y redirects

Dominio canónico: **www.muzikchile.cl**. `muzikchile.cl` y
`tienda.muzikchile.cl` (desde 2026-10-25, `/api` incluido) redirigen a www
como redirect de dominio en Vercel, no en el código. Los redirects de
`next.config.ts` son de rutas: `/?categoria=` → `/tienda`, y las rutas del
Channel sin equivalente acá → `tv.muzikchile.cl`, donde sigue el Channel
(reproductor y su admin). El webhook de MP (panel de la app, modo productivo y
de prueba) apunta a `https://www.muzikchile.cl/api/mercadopago/webhook`.

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
modo sandbox/prod, flag `cobro_modelo`, `comision_default`), `liquidaciones`,
`pagos_mp` (pagos de MP ya procesados) y `mp_conexiones` (cuenta de MP de cada
artista, tokens cifrados). Las dos últimas: RLS sin políticas, solo service role.

**La fuente de verdad del esquema es `lib/supabase/types.ts`** (generado), no los
queries. Los clientes de `lib/supabase/{client,server}.ts` están tipados con
`Database`, así que una columna inexistente es error de compilación.

#### Regla: todo cambio de esquema va por migración versionada

```bash
npx supabase migration new descripcion_del_cambio   # 1. crear
#                                                     2. escribir el SQL
npx supabase db push --linked                       # 3. aplicar (--linked: ver abajo)
npx supabase gen types typescript --linked > lib/supabase/types.ts   # 4. regenerar
```

**El paso 4 no es opcional, y va en el mismo commit que la migración.** Nada de
tocar el esquema desde el editor SQL del dashboard sin reflejarlo en una
migración. Ver `supabase/README-migraciones.md`.

`db push` va **siempre con `--linked`**: el CLI avisa (2026-10-24) que en su
próxima versión apuntará por defecto a la base local. Lo corre Claudio (pide la
contraseña de la base).

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

**Precio, stock, cupón y comisión se calculan solo en el servidor**, en
`lib/checkout/cotizar.ts`. El navegador manda `{ id, cantidad }` y el código del
cupón; nunca uses un precio que venga del body. La comisión
va sobre lo cobrado, después del descuento, y la decide **`lib/comision.ts`**:
founder sin `founder_hasta` = 0% de por vida; con fecha, 0% hasta ese día
inclusive (hora de Chile) y después `artistas.comision`. Un artista nuevo recibe
`app_settings.comision_default` (vía `comision_por_defecto()`); no hay un 10%
escrito en el código.

- `POST /api/checkout/cotizar` — lo que muestra el checkout (misma función).
- `POST /api/mercadopago/crear-preferencia` — cotiza, lee `mp_access_token` y
  `mp_modo` de `app_settings`, crea la preferencia e inserta una fila
  `pendiente` en `ordenes` por línea (`monto_artista + comision_monto` = lo
  cobrado por la línea).
- `POST /api/mercadopago/webhook` — consulta el pago en la API de MP (el aviso
  no se cree), compara monto y moneda, y llama a `confirmar_pago()`: órdenes a
  `pagado`, stock y cupón, **una sola vez por pago** (lock en `pagos_mp`).
  Devuelve 500 ante errores temporales para que MP reintente.
  La firma (`x-signature`) se revisa en cada aviso con `revisarFirma`
  (`lib/mp/firma.ts`) y se anota como `[webhook] firma:` — **fase 1: no se
  rechaza nada**. La firma no cubre el body: lo que trae el body se sigue
  confirmando contra la API de MP.
  Un pago `refunded` o `charged_back` llama a `revertir_pago()`: órdenes a
  `reembolsado`, stock no despachado de vuelta y uso del cupón −1, **una sola
  vez por pago** (lock en `pagos_mp.revertido_at`). Es el mismo camino venga
  de donde venga el reembolso: `/api/admin/mp/reembolsar` (marketplace, con el
  token del artista), el panel de MP del artista o el de MuzikChile. Un
  reembolso parcial no revierte nada (queda en el log). `reembolsado` no se
  elige a mano en `/admin/ordenes`.

### Marketplace de Mercado Pago (en construcción)

Flag `app_settings.cobro_modelo`: `centralizado` (hoy, todo entra a la cuenta de
MuzikChile) o `marketplace` (cada artista cobra con su cuenta y MuzikChile
recibe `marketplace_fee`). Cada artista conecta su cuenta en `/panel/cobros`
(OAuth con PKCE vía `auth.mercadopago.cl`, `lib/mp/`). `artistas.cobros_activos`
lo mantiene un trigger sobre `mp_conexiones`; nunca lo escribas a mano.
Si el artista desvincula la app desde MP, llega al webhook un aviso
`mp-connect` (`application.deauthorized`); `procesarDesvinculacion`
(`lib/mp/conexiones.ts`) no lo cree: consulta `/users/me` con su token y solo
si MP rechaza el token y también la renovación deja la conexión en `reconectar`.

**Piloto**: `app_settings.marketplace_piloto` (lista JSON de `artista_id`) pone
en marketplace a esos artistas aunque `cobro_modelo` siga en `centralizado`. La
regla única es **`lib/cobro.ts`** (`leerConfigCobro` + `modoCobro`); no
consultes los flags por tu cuenta. En marketplace: el carrito es de un solo
artista, los cupones globales no aplican, la preferencia va con el token del
artista (`tokenVigente`) + `marketplace_fee`, el webhook consulta el pago con
ese token (`?grupo=` en la `notification_url`) y las órdenes quedan con
`ordenes.cobro = 'marketplace'`, que **no entran en liquidaciones**. Un
listado o saldo nuevo sobre `ordenes` tiene que decidir qué hace con `cobro`.

La `notification_url` solo se envía a MP cuando `NEXT_PUBLIC_URL` es HTTPS (en
local, MP la rechaza).

Lectura de `artistas`: anon y authenticated tienen **grants por columna**, así
que `select("*")` falla con 42501; nombra las columnas. Los datos bancarios
(`banco`, `cuenta_bancaria`, `tipo_cuenta`, `rut`) se leen con la RPC
`datos_bancarios()`. Solo un admin puede cambiar `comision`, `es_founder`,
`founder_hasta`, `tienda_activa`, `verificado`, `cobros_activos` y `es_prueba` (trigger). Verificación:
`npm run verificar:cobro` y `npm run verificar:mp`.

**Artistas de prueba** (`artistas.es_prueba`, switch en `/admin/artistas`): no
aparecen en `/tienda`, en las noticias (`traerNoticias`), en el sitemap ni en
las métricas de `/admin`; su ficha, sus productos y sus notas abren solo por URL
directa, con `noindex`. **Un listado público nuevo tiene que filtrar
`es_prueba`** (con `artistas!inner(…)` + `.eq("artistas.es_prueba", false)`).

### Convenciones de estilo

Tailwind v4 (breaking changes desde v3 — leer `node_modules/next/dist/docs/` antes de asumir APIs v3).

- Headings: `font-family: Oswald` | Body: `font-family: Barlow` — vía `style={{}}` inline, no clases Tailwind
- Color marca: `#e8003d` | Fondo: `#f8f7f5`
- Inline styles y Tailwind coexisten intencionalmente
- **Paleta del rediseño**: tokens `--tema-*` en `app/globals.css` (Tailwind: `bg-tema-fondo`, `text-tema-azul-texto`…). Hoy los usan `/login`, `/recuperar` y `/registro` (piezas en `components/acceso/`), la tienda, el header público, y desde 2026-10-21 la portada, `/noticias`, `/contacto` y `/privacidad` (fondos, tarjetas, bordes y grises; los rojos de marca de `C` siguen). En estilos inline se usan vía `TEMA` de `lib/portada.ts` (`TEMA.fondo`, `TEMA.texto3`…), no con `C.negro`/`C.gris*`. Texto chico rojo/azul sobre oscuro va en las variantes `-texto` (AA), nunca en `tema-rojo`/`tema-azul`.
- Imágenes en Supabase Storage; host whitelisted en `next.config.ts`. Los
  buckets `artistas`, `productos` y `noticias` son públicos; **`comprobantes`
  es privado** (datos bancarios): se guarda la ruta y se abre con URL firmada
  (`abrirComprobante` en `lib/storage.ts`), nunca con `getPublicUrl`
- `export const dynamic = 'force-dynamic'` necesario en páginas con `useSearchParams` o para evitar SSG en Vercel

### Consentimiento (cookies y terceros)

**Nada de terceros sin permiso**, salvo la señal de tv. del hero de la portada,
que carga directo por decisión del 2026-10-25 (tv. trae YouTube y su propio
GA; la política de privacidad lo informa). `lib/consentimiento.ts` guarda la elección
(`muzik_consentimiento` en localStorage: `analitica`, `contenido`, versión y
fecha) y `BannerConsentimiento` la pide en el layout público; el footer la
reabre ("Preferencias de cookies").
- Google Analytics solo carga con `analitica` (`components/Analitica.tsx` →
  `AnaliticaConsentida`).
- Todo iframe o script de un tercero (YouTube, Spotify, Instagram…) va
  dentro de `<ContenidoTercero proveedor="…">`: sin `contenido` muestra un
  aviso con "Cargar" / "Permitir siempre" y no hace ninguna request.
- Si cambia lo que se pide, sube `VERSION_CONSENTIMIENTO`: el banner vuelve a
  aparecer.

### SEO

El sitio es **indexable desde el lanzamiento (2026-10-11)**. No hay noindex
global en `app/layout.tsx`.

- **Rutas privadas**: `/panel`, `/admin`, `/checkout`, `/carrito`, `/login`,
  `/registro` y `/recuperar` declaran su propio `noindex` en sus layouts. **Una
  ruta privada nueva tiene que declarar el suyo**: no lo hereda de ningún lado.
- **Canonical**: `metadataBase` (= `BASE_URL`) va en el layout raíz, pero el
  canonical NO — lo heredarían las páginas que no declaran uno. Cada página
  pública declara `alternates.canonical` y `openGraph.url` con ruta relativa.
  Una página pública nueva tiene que declarar los dos.
- `app/robots.ts` — único robots.txt (no agregues `public/robots.txt`): permite
  todo salvo `/panel`, `/admin`, `/api`.
- `app/sitemap.ts` — home, `/tienda`, `/noticias`, las noticias publicadas y
  las fichas `/artista/[slug]` de artistas con `tienda_activa` o `verificado`.
  Nunca artistas de prueba (`es_prueba`) ni sus noticias. Revalida cada hora.

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
- `lib/site.ts` — `BASE_URL` (desde `NEXT_PUBLIC_URL`), para robots, sitemap y
  OpenGraph; `CORREO_CONTACTO`. No escribas el dominio a mano en una página.
- `components/layout/nav-links.ts` — `NAV_LINKS` y `ACCESO_ARTISTAS_HREF`,
  compartidos por Header y Footer para que no se desincronicen

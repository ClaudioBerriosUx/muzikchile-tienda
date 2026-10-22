# PROGRESS.md — MuzikChile Tienda

> Actualizado: 2026-10-22
> Branch: `main` (lanzamiento mergeado y en producción en www.muzikchile.cl)

---

## ✅ Hecho

### Catálogo público
- Home (`/`) con grid de productos, filtros sticky (categoría, región, tipo, orden, búsqueda libre)
- Ficha de producto (`/producto/[id]`)
  - 2026-10-20: el enlace "Ver tienda de…" pasó a ser una tarjeta destacada (`components/tienda/ArtistaTiendaCard.tsx`, reutilizable)
- Tienda de artista (`/artista/[slug]`) con badge de verificado

### Carrito y checkout
- Carrito con Zustand + localStorage (`/carrito`, `CarritoDrawer`)
- Checkout completo con validación Zod/react-hook-form (`/checkout`)
- Aplicación de cupones en checkout (validación en cliente)
- Fix hidratación Zustand persist: evita redirect a `/` al hacer F5 en checkout (usa `persist.hasHydrated()` / `onFinishHydration()`)
- Preferencia de MercadoPago (`/api/mercadopago/crear-preferencia`) con cálculo de comisiones por artista
- Páginas de resultado: éxito, error, pendiente
- Fix modo sandbox/producción: checkout ahora lee `modo` de la respuesta del endpoint en vez de priorizar siempre `sandbox_init_point`
- Validación de cupones públicos en checkout (política RLS `public_read_cupones_activos` para rol `anon`)

### Integración MercadoPago
- Webhook implementado (`/api/mercadopago/webhook/route.ts`): recibe IPN, consulta pago en MP, actualiza `ordenes` a `pagado`/`cancelado`, incrementa usos de cupón, descuenta stock de productos físicos
- `notification_url` condicional: solo se envía a MP cuando `NEXT_PUBLIC_URL` es HTTPS (evita error "policy UNAUTHORIZED" en desarrollo local)
- Flujo end-to-end probado en producción real: compra exitosa, orden creada, página de éxito

### Auth
- Login / registro con Supabase Auth (magic link / email)
- Auto-asignación de rol `artista` en primer acceso al panel
- Auto-creación de registro `artistas` en primer acceso

### Panel artista (`/panel`)
- Dashboard con métricas (ventas, órdenes pendientes, ingresos del mes)
- Listado de mis productos
- Subir producto nuevo (con compresión de imágenes client-side, react-dropzone, validación Zod)
- Editar producto (`/panel/productos/[id]/editar`)
- Perfil del artista: nombre, slug, bio corta + larga, foto, redes sociales (Instagram, Spotify, YouTube, TikTok, SoundCloud), color acento, datos bancarios
- Mis cupones: CRUD completo (crear, editar, activar/desactivar)
- Liquidaciones: vista de historial de órdenes y pagos recibidos (solo lectura)

### Admin (`/admin`)
- Dashboard
- Productos: revisión `en_revision` → `aprobado`/rechazado, badge de pendientes en sidebar
- Artistas: listado, invitar por email, editar comisión, marcar founder, activar tienda, verificar
- Editar artista (`/admin/artistas/[id]/editar`) — fix carga de redes sociales (mismatch `redes_sociales` → `redes`)
- Categorías: CRUD
- Órdenes: listado con filtro por estado, cambio de estado
- Cupones globales: CRUD (columnas corregidas en `72e9b63`; validación de tipos reforzada el 2026-07-25)
- Liquidaciones: vista de artistas con saldo pendiente, registro de pagos realizados
- Configuración: tokens de MercadoPago con campos enmascarados

### Correcciones de schema (tabla `ordenes`)
- Columnas renombradas en código para coincidir con DB real: `nombre_comprador` → `comprador_nombre`, `email_comprador` → `comprador_email`, `external_reference` → `grupo_id`
- INSERT captura y loguea error explícito en vez de fallar silenciosamente

### Correcciones de schema (tabla `cupones`) — RESUELTO 2026-06-30
- **Bug crítico de cupón en MercadoPago resuelto**: la columna real es `tipo_descuento`, no `tipo`; y `expira_at`, no `fecha_expiracion`. La columna `monto_minimo` no existe en la tabla.
- Causa raíz: `crear-preferencia/route.ts` consultaba `select("id, tipo, valor")` → Postgres error `42703 column cupones.tipo does not exist` → `cuponData` quedaba `null` → el error se descartaba en silencio (`const { data: cupon } = await ...` sin capturar `error`) → el descuento nunca se aplicaba al `unit_price` enviado a MP.
- El mismo mismatch existía en `app/checkout/page.tsx`: `cuponAplicado.tipo` siempre era `undefined`, por lo que el descuento mostrado en el cliente se calculaba por la rama de "monto fijo" sin que se notara (coincidencia visual, no cálculo correcto).
- Verificado el schema real consultando la tabla `cupones` directo vía PostgREST (`GET /rest/v1/cupones`) en vez de asumir por el código.
- Diagnóstico hecho con logs temporales en Vercel (agregados y luego retirados) en los commits `bafbd48`, `93ca60a`; fix real en `93a9858`.

### Saneamiento de esquema — 2026-07-25
- **Tipos de Supabase generados**: `lib/supabase/types.ts` (`npx supabase gen types typescript --linked`, 8 tablas). `lib/supabase/{client,server}.ts` tipados con `<Database>`. Ahora un nombre de columna inventado es error de compilación, no bug silencioso en producción.
- **Fix ficha pública de artista**: `app/artista/[slug]/ArtistaClient.tsx` leía `redes_sociales`; la columna real es `redes`. Las redes sociales nunca se renderizaron en ninguna ficha pública. Confirmado contra el esquema real: `redes: Json`, `redes_sociales` no existe.
- **Fix `liquidaciones` (mismo patrón que el bug de cupones)**: el código usaba `fecha` y `comprobante`; las columnas reales son `fecha_transferencia` y `numero_comprobante`. Afectaba a `panel/liquidaciones` (select) y `admin/liquidaciones` (insert + historial).
  - El insert de admin además **no capturaba el error** (`await supabase...insert({...})` sin destructurar `error`), así que registrar un pago mostraba el toast "Pago registrado" mientras Postgres rechazaba con 42703. Misma causa raíz que el bug de cupones de 2026-06-30. Agregado `if (liqErr) throw liqErr`.
  - El historial de admin usaba `select("*")` + `as unknown as`, por lo que tsc no lo detectaba: `l.fecha` renderizaba `Invalid Date`.
- **Fix `productos.stock` en digitales**: la columna es NOT NULL, pero `panel/productos/{nuevo,[id]/editar}` enviaban `null` para productos digitales → violación de NOT NULL al crear/editar cualquier digital. Se adoptó `999` como sentinel de "ilimitado", que es la convención ya presente en los 3 digitales de producción. Importante: `ProductoClient` desactiva "Agregar al carrito" con `stock === 0` sin exceptuar digitales, así que 0 los dejaría sin poder comprarse.
- **Fix nullability en `login`**: `.eq("user_id", user?.id)` podía filtrar por `undefined`; agregado guard.
- **`supabase/migrations/` creado**, con la política documentada en
  `supabase/README-migraciones.md`: todo cambio de esquema va por migración, y los
  tipos se regeneran en el mismo commit. El README vive fuera de `migrations/`
  porque el CLI emite un warning por cada archivo de ahí que no sea una migración.
  ⚠️ El baseline todavía no existe — ver abajo.
- **`admin/cupones` cerrado** (estaba listado como roto en pendientes; ya no lo estaba):
  - El mismatch de columnas se había arreglado en el commit `72e9b63`. El archivo usa `tipo_descuento` y `expira_at`, no menciona `monto_minimo`, y sus tres write paths (`insert`, `update`, `toggleActivo`) ya capturaban el error exponiendo el mensaje real de Postgres en el toast. La entrada de "bugs conocidos" llevaba semanas describiendo un bug inexistente.
  - **Eliminado el `as unknown as Cupon[]`** que anulaba la validación de tipos. Reemplazado por un tipo derivado de `Database["public"]["Tables"]["cupones"]["Row"]`, lo que además corrigió tres nullabilities mal declaradas (`usos_maximos`, `expira_at`, `descripcion` son `| null`, no opcionales).
  - Comprobado que la protección muerde: agregando `monto_minimo` al `select` a propósito, tsc falla con `column 'monto_minimo' does not exist on 'cupones'`. Ese es exactamente el bug que costó las sesiones de depuración de junio.
  - **Renombrado `FormState.tipo` → `tipo_descuento`.** Era solo un campo del formulario local, pero `tipo` es literalmente el nombre que causó el bug original de junio; tenerlo vivo en el mismo archivo era dejar el cuchillo en la cuna. Ahora el nombre del campo, el del payload y el de la columna coinciden.

### Módulo de publicaciones · Tanda A — base de datos (2026-07-25)

**Estreno del pipeline de migraciones.** Primera migración versionada del proyecto:
`supabase/migrations/20260725190514_crear_publicaciones.sql`, aplicada con
`db push` y con los tipos regenerados en el mismo cambio.

Tabla `publicaciones` (17 campos): nace lista para los tres tipos
(`noticia`, `convocatoria`, `fecha_abierta`) aunque en esta fase solo se usa
`noticia`; `fecha_cierre`, `ciudad` y `genero` quedan nullable para los tipos
futuros. FK a `artistas` con `ON DELETE CASCADE`, CHECK en `tipo`, `estado`
(`borrador` → `pendiente` → `publicada` | `devuelta`) y `visibilidad`, más
`char_length(titular) <= 80`. Índices en `artista_id`, `estado` y `tipo` — no en
`slug`, porque el `UNIQUE` ya crea uno.

Detalles de implementación:
- Usa `has_role(uuid, app_role)`, que **ya existía** en el proyecto, en vez de
  crear un `is_admin()` nuevo.
- La función de `updated_at` se llama `publicaciones_set_updated_at()` y no un
  nombre genérico: no se pudo verificar si ya existe una reutilizable (leer el
  esquema remoto exige Docker), y un `CREATE OR REPLACE` genérico podría haber
  pisado una función existente.

#### Las 9 políticas RLS

| Política | Qué protege |
|---|---|
| `select_publico` | anon y autenticados leen solo `publicada` + `publica` |
| `select_propias` | el artista ve todas sus filas en cualquier estado (su panel necesita borradores y devueltas) |
| `select_solo_artistas` | lo publicado con visibilidad restringida solo lo ven artistas y admins |
| `select_admin` | el admin ve todo — sin esto no podría moderar lo pendiente |
| `insert_propias` | solo crea a su propio nombre, y solo como `borrador` o `pendiente` |
| `update_propias` | solo edita lo suyo y solo en `borrador`/`devuelta`; nunca puede escribir `publicada` |
| `update_admin` | el admin mueve cualquier fila a cualquier estado |
| `delete_propias` | solo borra borradores propios: enviada a revisión, deja rastro |
| `delete_admin` | el admin borra cualquiera |

#### Dos restricciones agregadas más allá del encargo

Sin ellas la moderación sería decorativa:

1. **El `INSERT` limita `estado` a `borrador`/`pendiente`.** El default de la
   columna no protege nada: un cliente puede mandar `estado: 'publicada'`
   explícito e insertar ya publicado, saltándose la moderación entera.
2. **El `UPDATE` propio lleva `WITH CHECK` además de `USING`.** `USING` mira la
   fila *antes* (no puede tocar lo publicado); `WITH CHECK` mira la fila *después*
   y es lo que impide autopublicarse. Con solo `USING`, un artista pasaba de
   `borrador` a `publicada` en una sola llamada.

#### Verificado / pendiente de verificar

- ✅ RLS probado en vivo con la anon key: `SELECT` responde `200 []`, `INSERT` es
  rechazado con `42501 new row violates row-level security policy` (HTTP 401).
- ✅ Políticas de artista probadas end-to-end (6/6) — ver "RLS de publicaciones
  verificado" en la Tanda B.
- ⚠️ No se pudieron leer las políticas RLS existentes de `productos`/`artistas`
  para contrastar estilo: `db dump` exige Docker, `inspect db` solo da
  estadísticas y el CLI no tiene runner de SQL genérico. La consistencia se
  infirió de `has_role` + el enum `app_role`, que sí son verificables.

Sin UI en esta tanda: la del artista llegó en la Tanda B (abajo).

---

### Módulo de publicaciones · Tanda B — UI del artista (2026-07-25)

Solo el lado del artista. La moderación del admin y el feed público son tandas
siguientes.

**Rutas creadas**

| Ruta | Qué hace |
|---|---|
| `/panel/publicaciones` | Listado propio: portada, titular, categoría, fecha y `StatusBadge`. Si el estado es `devuelta`, muestra el `comentario_moderacion` del admin en un bloque destacado. Editar solo aparece en `borrador`/`devuelta`. |
| `/panel/publicaciones/nueva` | Creación |
| `/panel/publicaciones/[id]/editar` | Edición |

**Archivos nuevos**
- `app/panel/publicaciones/PublicacionForm.tsx` — formulario compartido por
  creación y edición. Dropzone de una imagen con preview, `comprimirImagen(archivo, 1200, 0.85)`,
  contador de caracteres restantes del titular, validación Zod, y **dos botones
  de envío**: "Guardar borrador" (`estado: 'borrador'`) y "Enviar a revisión"
  (`estado: 'pendiente'`). Nunca escribe `'publicada'` — el RLS lo rechazaría.
- `lib/publicaciones.ts` — `CATEGORIAS_NOTICIA` (lanzamiento / show / prensa /
  general), `generarSlug()`, `esEditable()`, `TITULAR_MAX`.

**Modificados**
- `components/ui/StatusBadge.tsx` — agregados `borrador`, `publicada` y
  `devuelta`. No estaba en el encargo pero era necesario: sin esas claves los
  estados caían al fallback gris mostrando la cadena cruda en minúscula.
  Aditivo, no toca las claves de productos ni de órdenes.
- `app/panel/PanelShell.tsx` — ítem "Mis publicaciones" en el sidebar.

#### Decisiones de diseño

- **El slug NO se regenera al editar.** Si el artista corrige el titular, la URL
  pública no cambia; regenerarla rompería enlaces ya compartidos. El slug se
  genera una sola vez, al crear.
- **`generarSlug` agrega sufijo aleatorio de 4 chars.** `publicaciones.slug` es
  UNIQUE y dos artistas pueden titular igual (o el mismo artista repetir
  titular): sin sufijo, el segundo insert falla por violación de unicidad.
- **Guard doble, UI + RLS.** La página de edición bloquea `pendiente` y
  `publicada` con un mensaje explicativo. El RLS `update_propias` rechazaría el
  update igual, pero fallar recién al guardar —después de que el artista
  reescribió todo— es una pésima forma de enterarse.
- **`maybeSingle()` en vez de `single()`** al cargar una publicación por id: si
  no es del artista, el RLS simplemente no devuelve la fila. Eso es un "no existe
  para ti", no un error que valga mostrar como fallo.
- **Imágenes en el bucket `productos`, subcarpeta `{artista_id}/publicaciones/`.**
  Reutiliza el bucket existente en vez de depender de uno nuevo que habría que
  crear a mano en el dashboard.
- **El listado filtra por `artista_id` explícito** aunque el RLS ya lo garantiza.
  Defensa en profundidad: si alguien afloja la política, la query sigue acotada.

#### ✅ RLS de publicaciones verificado end-to-end (6/6)

Verificado el 2026-07-25 y reconfirmado el 2026-09-25 con
`npm run verificar:rls` (`scripts/verificar-rls-publicaciones.mjs`), que monta
dos artistas reales con sesión autenticada vía service role, corre los casos y
limpia sus datos de prueba:

- ✓ (a) Artista INSERT con su propio `artista_id` → permitido
- ✓ (b) Artista INSERT con `artista_id` ajeno → rechazado
- ✓ (c) Artista UPDATE de contenido en su borrador → permitido
- ✓ (d) Artista UPDATE de su borrador a `estado: 'publicada'` → rechazado por el
  `WITH CHECK` de `update_propias`. **Un artista no puede autopublicarse.**
- ✓ (e) Artista no ve ni edita publicaciones de otro → SELECT 0 filas, UPDATE 0
- ✓ (f) Anon solo ve `publicada` + `publica`

---

### Branding oficial · Tanda BASE — logo, favicon y tokens (2026-07-26)

Solo la base: los tokens quedan **definidos y sin aplicar**. Migrar tarjetas,
badges y botones a la paleta nueva es la tanda siguiente.

**Tokens de color** — fuente de verdad en `app/globals.css`, bloque
`TOKENS DE MARCA`. Los 12 tokens (rojo/azul de marca, superficies, texto) con la
semántica documentada uno por uno: **rojo = acción y marca, azul = información**.
Se exponen por dos vías, ambas apuntando a las mismas CSS variables:

- **Tailwind v4**: un `@theme` aditivo genera `bg-brand-rojo`,
  `text-texto-secundario`, `border-borde`, etc. No pisa las escalas de shadcn del
  `@theme inline` que ya existía.
- **TypeScript**: `MARCA` en `lib/portada.ts`, con cada clave apuntando a su
  `var(--…)` — sin un solo hex duplicado. Existe porque el proyecto estila mucho
  inline, donde no entran clases de Tailwind; es el mismo puente que ya usaba `F`
  para las tipografías.

`C` (paleta del Channel) queda intacta y marcada como heredada: código nuevo usa
`MARCA`, no `C`.

**Archivos de marca**
- `public/muzi_logo_V3-2-CgzsvQpL.svg` → `public/logo.svg`
- `public/favicon-32x32.png` → `app/icon.png` (convención de archivo de Next 16)
- **Borrado `app/favicon.ico`** (el stock de Next). Convivía con `icon.png`
  emitiendo su propio `<link>`, y cuál ganaba quedaba a criterio del navegador.

**Logo** — nuevo `components/layout/Logo.tsx`, en `Header` (40px, `priority` por
LCP) y `Footer` (44px). El tamaño se fija con `height` + `width: "auto"`: preserva
la proporción y evita el warning de dev por modificar una sola dimensión. Como el
`src` termina en `.svg`, Next 16 lo sirve sin optimizar solo, así que **no** hace
falta `dangerouslyAllowSVG`.

#### Tres hallazgos sobre el SVG entregado

1. **No contiene la M en círculo.** El círculo con degradado existe en el archivo
   pero en coordenadas fuera del `viewBox` (`cx=-923`, `cx=-1652`), donde el SVG
   lo recorta. Lo visible es el lockup "MUZIK" con la estrella. El icono circular
   solo existe como PNG (el favicon). Si se quiere el círculo en la web, hay que
   pedir un SVG aparte.
2. **El wordmark es blanco** (`fill="#FFFFFF"`). Sobre fondo claro desaparece.
   Header y Footer son negros, así que ahí funciona — pero **no se puede reusar
   tal cual en `/login`, `/registro` ni `/recuperar`**, que tienen fondo claro y
   hoy siguen con su wordmark en texto.
3. **~90% del archivo es descarte de Illustrator**: otras versiones del logo,
   degradados amarillos y `<text>` con las fuentes `'Null-Free'` y
   `'Prime-Regular'`, que nadie tiene instaladas. Todo eso cae fuera del `viewBox`
   y no se renderiza, pero infla el archivo a 14KB y viaja en cada carga. Además,
   el 21% superior del `viewBox` está vacío (la tinta más alta empieza en y≈35 de
   167), por eso el alto es 40px y no 36. Se dejó **tal cual se entregó**; limpiarlo
   es un cambio de un par de líneas que no toca el dibujo.

**Verificado en el navegador**: logo visible en header y footer,
`<link rel="icon" href="/icon.png" sizes="420x420" type="image/png">` en el
`<head>`, `/icon.png` y `/logo.svg` responden 200, y `/favicon.ico` responde 404
(ya no hay icono en competencia). `tsc --noEmit` limpio y `npm run build` OK.

⚠️ El PNG mide **420×420**, no 32×32 como sugiere el nombre original. Es mejor
así (pestañas retina, marcadores, PWA); no se tocó.

### Portada · Composición B2 — el reproductor solo arriba (2026-07-26)

Solo `app/(publico)/page.tsx`. No se tocó `Hero.tsx`, `VideosDestacados.tsx` ni
`UltimasNoticias.tsx`.

**El orden del DOM no cambió** — Hero → Conecta → Videos → Noticias, igual que
antes. Lo que hacía que el H1 se leyera como bajada del reproductor eran los
fondos: la sección "Conecta" era `negroSuave`, el mismo color en que termina el
degradado del Hero, así que compartían banda y se agrupaban como un bloque. El
corte visual caía recién en `VideosDestacados`, que es `negro`.

Agrupación antes: `[Hero + H1] | [Videos]` · ahora: `[Hero] | [H1 + Videos]`.

El cambio real fue mover ese corte, no reordenar componentes:
- **"Conecta" pasó a `C.negro`**, el mismo fondo de `VideosDestacados`, para que
  las dos secciones se lean como una sola zona encabezada por el H1.
- **Padding asimétrico deliberado**: `pt-24 pb-4` (antes `py-16`). Con los
  `pb-14` del Hero arriba y los `pt-14` de `VideosDestacados` abajo da 152px de
  respiro tras el reproductor y 72px hasta "VIDEOS DESTACADOS" — proporción
  ~2:1, que es lo que agrupa el H1 hacia abajo. Medido en el DOM, no estimado.

El H1 conserva su estilo (Oswald, `clamp(30px, 5vw, 52px)`, centrado).

⚠️ **Pendiente estético menor**: el degradado del Hero va de `negro` a
`negroSuave`, o sea que llega a su punto **más claro** justo donde ahora
queremos el corte a negro. El escalón #0a0a0a → #000000 es casi imperceptible,
pero invertir el degradado del Hero haría que se funda con el respiro negro.
No se hizo: exige tocar `Hero.tsx` y es un cambio de color, los dos fuera del
encargo de esta tanda.

### Footer · Redes sociales oficiales (2026-07-26)

Las 4 URLs eran placeholders inventados (`/muzikchile` en las cuatro
plataformas); ninguna resolvía a una cuenta real. Reemplazadas por las oficiales.
Dos no son adivinables desde el nombre de la marca, así que **no se deducen, se
copian de la plataforma**: Instagram es `muzikchilecl`, y el usuario de Spotify
es un id numérico (`31vwdbu464l2bt3lqquh76gwhuda`), no un handle.

Los 4 iconos y sus SVG inline ya existían de la tanda del Channel — solo cambió
el destino y el comportamiento: blanco en reposo, **hover a `--brand-rojo`**,
transición 200ms, icono 16px → 20px. Siguen con `target="_blank"` +
`rel="noopener noreferrer"`, y el `aria-label` pasó a "MuzikChile en X" para que
tenga sentido leído solo por un lector de pantalla.

**Primer consumo real de los tokens de marca** (la tanda anterior los dejó solo
definidos). Dos detalles que costaron entender y conviene no repetir:

- **El hover va por clases, no por `onMouseEnter`.** `Footer.tsx` es Server
  Component: un handler de eventos no cruza esa frontera. El botón "Acceso
  artistas" del Header sí usa `onMouseEnter`, pero ese archivo es `"use client"`.
- **El color tuvo que salir del `style` inline.** Un estilo inline le gana en
  especificidad a `hover:`, así que mientras `color` siguiera ahí el hover no se
  veía. En el inline quedó solo el borde.

El Header **no tiene iconos de redes** — su franja roja del Channel es un
`border-bottom`, no una barra de iconos. No había nada que aplicar ahí.

Verificado con hover real del mouse: el icono bajo el cursor computa
`rgb(191, 4, 17)` y los otros tres siguen en blanco.

### Tipografía definitiva · Anton + DM Sans (2026-07-27)

**Dos familias, dos roles, un solo lugar donde se decide.** Anton para todos los
titulares (h1–h4), DM Sans para todo el cuerpo. Se eliminaron Bebas Neue,
Oswald, Barlow, Barlow Condensed y Geist Sans.

**Dónde vive la configuración** — `app/globals.css`, bloque `TIPOGRAFÍA`:
`--font-titulo` y `--font-body`. Las familias se cargan en `app/layout.tsx` con
next/font (`--font-anton`, `--font-dm-sans`); el mapeo rol → familia es lo único
que hay que tocar para cambiar la tipografía del sitio entero. Se consume por
tres vías, todas apuntando ahí: la regla de `@layer base`, las utilidades
`font-sans` / `font-heading` de Tailwind, y `F.titulo` / `F.body` en
`lib/portada.ts` para el estilo inline.

**Se borró el `@import` de Google Fonts de `globals.css`.** Pedía Oswald, Barlow
y DM Sans por red en cada carga, en paralelo con las mismas familias
self-hosted por next/font. Ahora no hay ningún request a fonts.googleapis.com.

#### La regla central lleva `!important`, y es a propósito

```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-titulo) !important;
  font-weight: 400 !important;
}
```

Sin `!important` esto no puede ser central en este proyecto: media web estila
con `style={{ fontFamily }}` inline, y un estilo inline le gana a cualquier
selector por especificidad. Un `!important` de autor sí le gana al inline
(importancia > especificidad en el orden de la cascada). Consecuencia práctica:
**un heading nuevo no necesita declarar tipografía.** Si querés jerarquía,
cambiás el `fontSize`.

El `font-weight: 400 !important` no es decorativo: **Anton solo tiene un peso.**
Pedirle 600/700 hace que el navegador lo engorde sintéticamente y se ve
emborronado. La regla neutraliza de una los `font-bold` y `fontWeight: 700`
sueltos que quedaban repartidos por el sitio.

#### El barrido

Codemod sobre 52 archivos: **654 declaraciones `fontFamily`** migradas de
literales (`"Oswald, sans-serif"`, `"Barlow, sans-serif"`, `"DM Sans, sans-serif"`)
a los tokens `var(--font-titulo)` / `var(--font-body)`. El reparto se decidió
por la etiqueta que envuelve cada declaración, no por el valor viejo: 79 a
titulares (h1–h4 + `DialogTitle` / `SheetTitle`, que Radix renderiza como `h2`)
y 575 a cuerpo. Además se retiraron **60 `fontWeight` de titulares**, que la
regla global dejaba inertes y solo confundían al leer el código.

Reemplazar el valor y no borrar la propiedad fue deliberado: si se borraban los
literales sin más, al quitar Barlow del `@import` esos 383 sitios caían a la
sans del sistema, no a DM Sans.

**Los `<p>` / `<div>` / `<span>` que usaban Oswald pasaron a DM Sans**, no a
Anton: nombres de producto en tarjetas, números de métricas, iniciales de
avatar, estados vacíos. Son cuerpo, aunque el original les diera aire de
titular. Única excepción: el logotipo "MuzikChile·" de `/login`, `/registro` y
`/recuperar`, que es marca y quedó en Anton (sin el `fontWeight: 700`, que
habría sido falso bold).

**Casos especiales revisados**
- El H1 "CONÉCTATE CON LA MÚSICA CHILENA" pasó de Oswald a Anton.
- `.contenido-noticia` (renderizador público) y `.editor-contenido` (TipTap):
  titulares en Anton, cuerpo en DM Sans. Al editor se le quitó el
  `font-weight: 600`.
- El badge "Sonando ahora" **no se tocó**: ya usaba `F.dmSans` → `F.body`, o
  sea exactamente la misma fuente que antes.

**Geist Mono se mantuvo**: la utilidad `font-mono` se usa en 4 lugares reales
(códigos de cupón, N° de comprobante). Geist Sans sí se fue — estaba cargada
pero no la referenciaba nadie (`--font-sans: var(--font-sans)` era circular).

⚠️ **No se verificó en navegador.** `tsc --noEmit` limpio, `npm run lint` sin
regresiones (52 problemas, idénticos a los de HEAD) y `npm run build` OK, pero
la revisión visual —incluida la de acentos y ñ— quedó pendiente. El subset
`latin` de Google cubre U+00C0–U+00FF, así que á/é/í/ó/ú/ñ deberían estar; hay
que confirmarlo mirando.

---

### Popup de suscripción al boletín + tabla `suscriptores` (2026-07-27)

Recrea el popup del Channel (mismo comportamiento) con diseño nuevo y los tres
agujeros de seguridad del original cerrados.

#### No es un modal, y eso cambia el código

Tarjeta flotante blanca anclada abajo a la derecha (380px en escritorio; de
borde a borde con margen bajo 640px), **sin overlay**: la página sigue visible
y usable. Entra con un slide-in corto de 16px + fade
(`.entrada-popup` en `globals.css`, con su `prefers-reduced-motion`).

Esa decisión arrastra tres consecuencias en el código que **no son detalles
sueltos** y conviene no "corregir" sin entenderlas:

- **No roba el foco al aparecer.** Un modal sí debe hacerlo; una tarjeta que
  interrumpe sin bloquear, no — te sacaría del campo o del video que estás
  usando.
- **No captura Escape.** Esa tecla le pertenece a lo que sí bloquea (el modal
  de video de la portada). Si la tomara, una pulsación cerraría las dos cosas.
- **No hay "clic fuera".** Fuera de la tarjeta está la página; hacer clic ahí
  es navegar, no cerrar. El único cierre es la ✕.

Por lo mismo es un `<aside>` con `aria-labelledby` y **no** un
`role="dialog" aria-modal="true"`: anunciarla como diálogo modal le mentiría a
un lector de pantalla sobre el estado de la página.

**z-index 40**, elegido contra los que ya existen: por encima del grano de
película (15) para que no le tiña el blanco, y por debajo del header sticky
(50) y del modal de video (100). Un aviso del boletín nunca debe ponerse
delante de la navegación ni de algo que la persona abrió a propósito.

**Migración** `20260727030917_crear_suscriptores.sql`, aplicada con `db push` y
tipos regenerados en el mismo cambio.

Tabla mínima a propósito: `id`, `email` (UNIQUE), `estado`
(`activo`/`inactivo`, con CHECK), `origen`, `created_at`. **Sin IP, sin user
agent, sin referrer**: el público es internacional (RGPD) y el dato que no se
recoge es el que no hay que proteger, exportar ni borrar después.

RLS asimétrica: **INSERT público** (`with check (true)` — es un formulario sin
sesión), **SELECT/UPDATE/DELETE solo admin** vía `has_role`. Que anon no pueda
leer es lo que evita que la tabla sea un directorio de correos consultable con
la anon key, que es pública por diseño.

#### Los tres agujeros cerrados

1. **Validación de email real.** `lib/suscriptores.ts` —
   `/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i` más tope de 254 chars. El
   original hacía `email.includes("@")`. Vive fuera del componente para poder
   ejercitarse sin abrir un navegador; **17/17 casos pasan**, incluidos los que
   el chequeo viejo dejaba entrar: `a@b`, `@dominio.cl`, `hola @ mail.cl`,
   `juan@.cl`, `juan@dominio.c`.
2. **Honeypot.** Input `name="empresa"` con `display:none`, `tabIndex={-1}`,
   `autoComplete="off"` y `aria-hidden`. Si viene con valor, **finge éxito y no
   inserta nada**: responder "error" le enseñaría al bot cuál campo lo delató.
   El `autoComplete="off"` no es adorno — un autofill del gestor de contraseñas
   sería un falso positivo que bloquearía a una persona real.
3. **Duplicados por el UNIQUE, no por chequeo previo.** Se intenta el INSERT y
   se captura el `23505`; se muestra "Este email ya está suscrito" en ámbar (no
   en rojo: no hizo nada mal) y se marca como suscrito para no volver a
   molestar. Un "¿ya existe?" previo sería a la vez imposible (anon no puede
   leer) y una condición de carrera.

**Falta, documentado en el componente y en la migración**: rate limiting por IP
(la que más falta hace — hoy nada impide 10.000 altas desde un script),
captcha/Turnstile y doble opt-in con token. Las tres necesitan servidor;
ninguna se puede expresar como política RLS.

#### Verificado contra la base real (anon key, vía PostgREST)

| Prueba | Resultado |
|---|---|
| INSERT anon | `201` ✅ |
| INSERT duplicado | `23505 duplicate key value violates unique constraint` ✅ |
| SELECT anon | `[]` — el RLS no deja leer la lista ✅ |
| INSERT con `estado: 'superadmin'` | `23514 violates check constraint` ✅ |

Las filas de prueba se borraron después (la tabla quedó vacía).

⚠️ El honeypot, el disparo (15s / 30% de scroll / cooldown de 7 días en
localStorage) y el diseño de la tarjeta están verificados **por lectura del
código y por build, no manejando la UI**: la comprobación en navegador no se
llegó a hacer.

**Otros archivos**
- `components/ui/PopupSuscripcion.tsx` — montado solo en la portada.
- `app/globals.css` — keyframes `entrada-popup` (tercera animación del archivo
  que respeta `prefers-reduced-motion`, junto a `halo-senal` y `grano`).
- `app/(publico)/privacidad/page.tsx` — plantilla honesta: describe lo que el
  sitio hace hoy y lleva un aviso visible de "borrador" más un TODO con lo que
  falta resolver con asesoría legal (responsable del tratamiento, correo real,
  base legal, plazos, encargados, transferencias internacionales).
  El correo `contacto@muzikchile.cl` es **placeholder**.
- `app/admin/suscriptores/page.tsx` — listado de solo lectura con buscador,
  contador de activos y exportación a CSV (con BOM, para que Excel en Windows
  no destroce los acentos). Entrada nueva en el sidebar de `AdminShell`.

### Portada · Reestructura de "Últimas noticias" (2026-07-27)

Solo `_portada/UltimasNoticias.tsx`. **La lógica de datos no se tocó**: mismo
`traerNoticias()`, mismos filtros, mismo `limit(3)`. Lo único que cambió en la
query es que ahora también trae `categoria`, para el badge.

**Antes**: destacada a la izquierda con `lg:row-span-2` + dos horizontales
apiladas a la derecha, en `grid-cols-2` parejo.
**Ahora**: `grid-cols-[55fr_45fr]` — destacada 55%, columna derecha 45% con las
dos horizontales **más una cuarta tarjeta CTA** al archivo (`/noticias`), sin
imagen, con flecha que se corre y se enciende en el hover.

Piezas nuevas: `Badge` (categoría), `Autor` (antes `Artista`), `SinImagen` y la
constante `TARJETA` con el estilo de borde/fondo que comparten las cuatro.

#### Detalles que costaron y conviene no deshacer

- **Las dos columnas se igualan solas.** No hay alto fijo: grid estira los items
  por defecto (`align-items: stretch`), y el bloque de texto de la destacada
  lleva `flex-1` para absorber el sobrante.
- **El CTA lleva `mt-auto`.** Así el hueco, cuando la destacada es más alta,
  queda ARRIBA del CTA y no entre las dos noticias. Es lo que mantiene el
  bloque alineado por abajo.
- **El color de la flecha va por clases, no en el `style` inline.** Un estilo
  inline le gana en especificidad a `hover:`; mientras `color` estuviera ahí, el
  cambio de tono no se veía. Mismo tropiezo que ya documentó el Footer con los
  iconos de redes.
- **El badge no se pinta si la categoría es desconocida.** `etiquetaCategoria`
  devuelve `"—"` en ese caso, y un badge con un guion es peor que ningún badge.

#### Dos cosas que son de DATOS, no de layout

1. **Las 8 noticias son `categoria: 'general'`**, así que los tres badges dicen
   "GENERAL". SHOW / PRENSA / LANZAMIENTO aparecerán cuando alguien las
   clasifique; el vocabulario ya existe en `lib/publicaciones.ts`.
2. **Las dos noticias más recientes tienen `bajada` vacía** (0 chars) desde la
   migración del Channel. Como la destacada es justamente la más reciente, hoy
   **la tarjeta grande no muestra párrafo**: sale imagen + autor + fecha +
   titular y nada más. No es un bug del layout.

#### Sobre las imágenes (verificado, no se tocó)

Las 8 `imagen_url` son válidas y responden 200, pero apuntan al **proyecto
Supabase del Channel** (`yxqhtljhoceopnbcwdiy`, bucket `blog-images`), no al de
la Tienda. La migración trajo las filas y no copió los archivos. ⚠️ Si ese
proyecto se pausa, se borra o el bucket deja de ser público, la portada pierde
las 8 imágenes y no hay copia de este lado. Van por `<img>` plano, sin
optimizar: la destacada son 350KB de PNG.

Descartado de paso: **no hay ningún componente de subida de archivos en la
portada.** El texto "Imagen destacada / browse files" de una captura reportada
no existe ni en el código, ni en los datos, ni en `node_modules`, ni en el HTML
renderizado; los tres dropzones del proyecto viven en `/panel/**` y están en
español. Quedó sin explicar de dónde salía esa captura.

### Portada · El grano de película ahora sí tiembla (2026-07-27)

**El diagnóstico importa más que el arreglo: la animación NUNCA estuvo rota.**
Los `@keyframes grano` existían, la clase se aplicaba y `getAnimations()`
reportaba `running`. El problema era el número de steps.

`steps(1, end)` congela cada keyframe durante todo su intervalo: 10 keyframes
en 8s = **un salto cada 800ms**. Y como el ruido es estadísticamente uniforme
—se ve igual en todas partes—, un salto por segundo sobre esa textura pasa
inadvertido. El efecto parecía estático sin estarlo.

`steps(10)` subdivide CADA intervalo en 10 → ~100 posiciones en 8s, **un salto
cada 80ms ≈ 12,5 fps**, que es el rango en que el ojo lo lee como grano de
película. Es lo que usa la referencia.

**Cambios**
- `globals.css`: `steps(1, end)` → `steps(10)`; traslaciones de ±4% a ±8%.
- `GrainOverlay.tsx`: capa de 200%/-50%/-50% → **300%/-110%/-50%** (los valores
  de la referencia), y `OPACIDAD` 0.08 → 0.12. Lo segundo no es capricho: el ojo
  detecta mucho peor el MOVIMIENTO de algo de bajo contraste que su presencia.

**Por qué ±8% y no más**: las traslaciones son % del propio elemento, que mide
300% del viewport → ±8% son ±24% de pantalla. Con los offsets actuales sobra
50% de viewport a la izquierda y 90–110% arriba/abajo, así que ningún borde
asoma. Pasar de ~16% sí destaparía el borde derecho.

#### Verificado en el navegador (no solo en el CSS)

- `getComputedStyle().transform` muestreado a lo largo del ciclo: **10 matrices
  distintas**, barriendo ~460px en horizontal y ~180px en vertical. Con un tile
  de ruido de 160px, cada salto (~38px) descorrelaciona un cuarto del patrón.
- ⚠️ **Para muestrear un transform animado hay que forzar recálculo**
  (`getBoundingClientRect()` + `requestAnimationFrame` entre lecturas). Sin eso
  `getComputedStyle` devuelve la identidad y parece que no se mueve — me pasó, y
  es exactamente el falso negativo que haría pensar que el arreglo no funcionó.
- **Rendimiento: sin costo medible.** 144,1 fps con la capa vs 144,0 sin ella;
  peor frame 7,5ms vs 7,4ms. Medido en viewport 2560×1249.
- ⚠️ La capa son 29,9 Mpx (~114MB si se rasterizara entera; el navegador tesela
  y no lo hace). En equipos modestos ese es el primer dial a bajar: volver a
  `200%/-50%/-50%` cuesta menos de la mitad y **alcanza de sobra** para las
  traslaciones actuales, sin tocar los keyframes.

`prefers-reduced-motion` sigue dejando el grano estático (regla verificada en el
CSS compilado: `.grano-overlay{will-change:auto;animation:none}`), pero no se
ejerció activando la preferencia en el navegador.

⚠️ **Turbopack sirvió CSS rancio durante la verificación**: tras editar
`globals.css`, el dev server reiniciaba en 533ms reusando el chunk viejo y
seguía entregando `step-end`. Hubo que borrar `.next`. Si un cambio de CSS "no
aparece", sospechar de esto antes que del código.

---

### Retoma 2026-09-25

Proyecto retomado tras 2 meses sin tocar.

**Estado verificado**
- Supabase `rgskspvuvzwmvmsccoez` estaba **pausado** por inactividad (plan Free):
  el host no resolvía DNS (`ENOTFOUND`). Restaurado desde el dashboard; conexión
  confirmada (`artistas`: 5 filas).
- `npm run verificar:rls` → **6/6** (ver Tanda B).
- `npm run build` OK, y el sitemap ya consulta artistas sin error.
- `tsc --noEmit` OK.
- Baseline de esquema generado en `supabase/schema_baseline.sql` (ver
  "Siguiente" punto 0).

**Pendientes abiertos por esta retoma**
- 🔐 **Rotar la service role key de Supabase y el token de Vercel** — se
  filtraron en chats en julio. Tras rotar, actualizar `.env.local`, las env vars
  del proyecto en Vercel y el secreto `SERVICE_ROLE_KEY` de la Edge Function
  (`npx supabase secrets set`). El Redeploy de Vercel de la rotación lleva
  también el cambio de `/admin/artistas` (sin plan B de `signInWithOtp`).
- **Keep-alive de Supabase Free** mientras no se lance: GitHub Action con cron
  cada 3-4 días que haga una consulta simple, para que el proyecto no se vuelva a
  pausar.
- **Confirmar qué commit está desplegado en producción.** El deploy es manual
  (`vercel --prod`), así que `origin/main` no implica producción.
- **Lint: 11 errores** de las reglas de React Compiler — `set-state-in-effect`
  (`carrito/page.tsx`, `CarritoDrawer.tsx`, `admin/artistas`,
  `admin/configuracion`, `admin/productos`), "Cannot create components during
  render" (`admin/configuracion`) y "This value cannot be modified"
  (`carrito/page.tsx:136`). El build no los bloquea.
- `app/sitemap.ts:32` tiene un TODO rancio: dice que `/tienda` no existe, pero ya
  existe.
- 🐛 **Carpetas inconsistentes de la foto de perfil** (pendiente de código). El
  artista sube a `artistas/{user_id}/foto.jpg` (`panel/perfil`) y el admin a
  `artistas/{artistas.id}/foto.{ext}` (`admin/artistas/[id]/editar`): la misma
  foto vive en dos carpetas según quién la subió, y el archivo del otro queda
  huérfano. Las políticas de storage cubren ambos casos (el admin escribe en
  cualquier carpeta), así que no se rompe nada; es orden, no seguridad. Unificar
  en `{user_id}` requiere que el admin conozca el `user_id` del artista (y los
  perfiles sin `user_id`, como el editorial, no tienen).

### Storage · Políticas por dueño en `artistas` y `productos` (2026-09-25)

Hallazgo del baseline: **cualquier usuario autenticado podía sobrescribir
cualquier archivo** de los dos buckets (`artistas_update` / `productos_update`
abiertas, y las permisivas se suman con OR) y **crear archivos en carpetas
ajenas** (INSERT abierto). Demostrado antes de arreglar: A pisó la foto de
perfil de B sin error.

Segundo hallazgo: en `productos` las políticas `*_own` **nunca coincidían**.
Comparaban la primera carpeta con `auth.uid()`, pero las rutas de ese bucket
empiezan con `artistas.id`, que es un uuid distinto de `user_id` (0 de 5
artistas los tienen iguales). Por eso el `remove()` de `lib/storage.ts`
devolvía éxito sin borrar nada.

**Migración `20260925191923_storage_politicas_por_dueno`**

| Bucket | Carpeta = | INSERT / UPDATE / DELETE del artista | Admin |
|---|---|---|---|
| `artistas` | `user_id` | `artistas_insert_own` (nueva), `*_update_own`, `*_delete_own` (se mantienen) | `artistas_admin_{insert,update,delete}` |
| `productos` | `artistas.id` | `productos_{insert,update,delete}_own` con subselect a `artistas where user_id = auth.uid()` | `productos_admin_{insert,update,delete}` |

Borradas: `artistas_update`, `artistas_upload`, `productos_update`,
`productos_upload`, y las `productos_*_own` viejas. SELECT sin cambios (lectura
pública). Admin vía `public.has_role(auth.uid(), 'admin')`.

**Publicaciones editoriales**: no tienen `artista_id` null — apuntan al perfil
`muzikchile` (`es_editorial`, sin `user_id`). Sus 8 imágenes viven en el Storage
del Channel (`yxqhtljhoceopnbcwdiy`), cargadas por `migrar-noticias-channel.mjs`
con service role, y **no existe UI donde el admin suba imágenes de
publicaciones** (el editor TipTap inserta por URL). Si se agrega, la ruta natural
`productos/{id_editorial}/publicaciones/…` queda cubierta por la política admin
(caso j).

**Verificación: `npm run verificar:rls-storage`** (`scripts/verificar-rls-storage.mjs`)
— antes de la migración **5/10** (fallaban a, c, f, h, i), después **10/10**.
Cada caso se decide leyendo el bucket con service role, no por el error: Storage
no reporta los rechazos de `remove()` ni de `update()`.

- (a) A sobrescribe la foto de B → rechazado · (b) A actualiza la suya → permitido
- (c) A sobrescribe un archivo de B en productos → rechazado · (d) el suyo → permitido
- (e) A borra la imagen de publicación de B → sigue ahí · (f) la suya → desaparece
- (g) Admin reemplaza foto en `artistas/{artistas.id}/` → permitido
- (h)/(i) A crea un archivo nuevo en la carpeta de B (artistas / productos) → rechazado
- (j) Admin sube imagen de publicación editorial → permitido

`verificar:rls` (publicaciones) sigue 6/6. `gen types` sin cambios de esquema
(storage no está tipado; solo difería el formato del CLI nuevo, no se regeneró).
El TODO de `lib/storage.ts` quedó cerrado.

### Seguridad · Alta de artistas solo por invitación (2026-09-25)

Había **dos puertas** para convertirse en artista sin que el admin lo decidiera:

1. **`invitar-artista` estaba abierta a internet**: `verify_jwt: false` y ningún
   control en el código. Cualquiera podía hacer POST con `{email}` y la función,
   con service role, invitaba ese correo y le asignaba rol `artista`. Además
   logueaba el body completo.
2. **Autoalta vía `artistas`**: el registro público de Auth está abierto
   (`disable_signup: false`), `artista_insert_own` solo pedía
   `auth.uid() = user_id`, y el trigger `trg_assign_artista_role` (SECURITY
   DEFINER) regala el rol a quien inserte su fila. Registrarse + un insert por
   API = artista.

Se revisó `auth.users`: solo están el admin y la cuenta de prueba
`claudio@agencia.sbs` (Valentina Ruz). Nadie se coló.

**Cambios**
- Migración `20260925194955_user_roles_fk_y_alta_artista`:
  - borra los 2 `user_roles` huérfanos (`57d1d452…`, `9f360f66…`, de las
    pruebas del 2026-06-02) y agrega **FK `user_roles.user_id → auth.users(id)
    ON DELETE CASCADE`**;
  - `artista_insert_own` ahora exige además `has_role(auth.uid(), 'artista')`:
    solo crea su fila quien ya fue invitado. `PanelShell.ensureArtistaRecord`
    sigue funcionando.
- `invitar-artista` (v9): 401 sin token / token inválido (`auth.getUser`), 403 si
  no es admin (`has_role`), 400 email inválido, 429 si el SMTP pone rate limit.
  Logs sin body ni email. `verify_jwt` **sigue en `false`** (el deploy conserva
  lo que había porque el repo no tiene `supabase/config.toml`); la seguridad no
  depende de él — la función verifica sola.
- `/admin/artistas`: se quitó el plan B `signInWithOtp({ shouldCreateUser: true })`
  — creaba usuarios sin rol que después no podían entrar al panel. Ahora muestra
  el error real de la función. **Pendiente de deploy a Vercel** (va en el mismo
  Redeploy que la rotación de claves).

**Verificación: `npm run verificar:invitar`** (`scripts/verificar-invitar-artista.mjs`)
— antes **1/4** (sin c; fallaban a, b, d), después **5/5**. (a) y (b) mandan un
email inválido: la función vieja respondía 400 (llegaba a `inviteUserByEmail`
sin mirar quién llamaba); la nueva corta antes con 401/403. (c) manda un correo
real a `raices.berrios+rlstest-<ts>@gmail.com`; con `--sin-invitacion` se salta.

- (a) Sin sesión → 401 · (b) sesión artista → 403
- (c) Sesión admin → invita y el invitado queda con rol `artista`
- (d) Usuario sin rol inserta su fila en `artistas` → rechazado, sigue sin rol
- (e) Artista invitado crea su fila en `artistas` → permitido

Sin regresiones: `verificar:rls` 6/6, `verificar:rls-storage` 10/10. Tipos sin
cambios.

**Pendiente (dashboard, fuera del repo):** Authentication → Sign In / Providers
→ desactivar **"Allow new users to sign up"**. Las invitaciones siguen
funcionando con el registro cerrado. Cierra la puerta 2 por el otro lado.

### Supabase pausado + keep-alive (2026-10-03)

El proyecto principal se pausó por inactividad (plan gratuito, 7 días) y el
sitio entero cayó: el dominio `rgsksp….supabase.co` daba NXDOMAIN. Tras
restaurarlo, el DNS vuelve antes que los servicios: durante un rato la raíz
`/rest/v1/` responde 401 pero cualquier tabla da **521**. "Activo" en el
dashboard no significa listo.

`.github/workflows/supabase-keep-alive.yml` (commit `44a901d`): cron cada 3
días, `count` de `categorias` vía REST con la publishable key (secret
`SUPABASE_PUBLISHABLE_KEY`). Falla en rojo si Supabase no responde. ⚠️ GitHub
desactiva los crons tras 60 días sin commits en el repo.

### Noticias en formato 4:5 · Portada + feed (2026-10-03)

- **Portada** (`_portada/UltimasNoticias.tsx`): destacada a todo el ancho
  (imagen 1/3 + texto centrado con "Leer nota completa →") y fila de 3
  tarjetas. 1 columna en móvil, 2 en tablet con la 4ª noticia oculta (sin
  huérfana), 3 en escritorio. Usa `traerNoticias(4)`; su consulta propia se
  eliminó. Se quitó la tarjeta CTA "Revisa el archivo completo".
- **`components/noticias/ImagenNoticia.tsx`**: contenedor 4:5 + `next/image`
  `fill`/`object-cover`/`object-center` + placeholder del mismo tamaño. Lo usan
  portada y `/noticias`. El og:image de `/noticias/[slug]` NO se tocó.
- **`lib/noticias.ts`**: campo `resumen` = bajada o, si viene vacía, extracto
  de 160 caracteres del cuerpo (`aTextoPlano`, corta en palabra completa).
- **`next.config.ts`**: se agregó el Storage del Channel (`yxqhtl…`) a
  `remotePatterns`. Las 8 noticias migradas sirven sus imágenes desde ahí; con
  `next/image` y sin ese host, portada y feed daban 500.
- Panel: texto "Formato recomendado: 1080×1350 px" y vista previa 4:5. Admin:
  vista previa 4:5 en el modal de moderación. `comprimirImagen` no deforma
  verticales (solo limita el ancho); solo se actualizó su comentario.
- Revisado a 375/768/1280 px. Ojo: Chrome headless con `--window-size=375` no
  baja el viewport real; para probar móvil hay que cargar la página en un
  iframe de 375 px.

**Las 8 imágenes migradas son horizontales 16:9** (se ve ~45% del ancho al
recortar a 4:5). Pierden contenido importante: **Santiago Horror** (título y
fechas del afiche cortados, hoy en la portada) y **Metalengua** (texto
"Ojitos de Planeta" y gente de los costados). Menor: **31 Minutos** (músicos de
los costados) y **Lechu** (borde del texto "Tranki"). Bien: Valparaíso, Rubio,
Alondra Noctvrna, Sequía.

**Resuelto en `2f4cdd9`:** `ImagenNoticia` mide la proporción en `onLoad` y, si
la imagen es más ancha que 4:5, la muestra completa (`object-contain`) sobre la
misma imagen desenfocada y oscurecida. Santiago Horror y Metalengua ya se leen
enteras. Fondo y frente comparten `src` + `sizes`: verificado por CDP, sin
descargas duplicadas. ⚠️ **Lechu quedó peor**: su archivo es un 16:9 con el
afiche vertical y barras negras horneadas, así que en `contain` el afiche se ve
diminuto. Pendiente: resubir el afiche vertical original de Lechu.

### Incidente: producción sin noticias tras la pausa (2026-10-03)

Producción mostraba "Todavía no hay noticias" y la portada sin la sección. **No
era la clave** (es `sb_publishable_…`, la misma que local, y responde 200 con
las 8 filas) ni caché del CDN: era **el build**. El deploy de `44a901d` corrió
mientras Supabase terminaba de restaurarse (PostgREST: *"Could not find the
table 'public.publicaciones' in the schema cache"*); `traerNoticias` devolvía
`[]` ante el error, y `/` y `/noticias` eran estáticas sin revalidación, así
que el vacío quedó congelado. Los deploys siguientes ya salieron bien.

Arreglo de fondo:
- `lib/noticias.ts`: un error de Supabase (o faltan las env vars) **lanza**;
  ya no se convierte en `[]` / `null`. En `traerNoticiaPorSlug` evita además
  un 404 falso.
- `/` y `/noticias`: `revalidate = 300` (ISR). Una noticia nueva aparece sin
  deploy, y si una regeneración falla Next sigue sirviendo la última buena.
- Probado: build con URL de Supabase inválida → falla con "Error occurred
  prerendering page /noticias" (en Vercel queda vivo el deploy anterior).

Las variables de Vercel están marcadas Sensitive: `vercel env pull` devuelve
`[SENSITIVE]`. Para ver qué clave usa producción, las `NEXT_PUBLIC_*` están en
el JS público del sitio.

`app/sitemap.ts` tenía el mismo patrón (devolvía solo las estáticas ante un error); corregido para que lance igual que `lib/noticias.ts`.

### Noticias editoriales desde el admin + `fecha_publicacion` (2026-10-03)

Contexto: la noticia "Café Rock" se subió desde el admin del **Channel** a su
tabla `noticias` (otro Supabase); la tienda lee `publicaciones` y nunca la vio.
Ahora el admin de la tienda escribe editoriales directo.

**Convención editorial** (la de las 8 migradas): `artista_id` = perfil
`muzikchile` (`c532a692…`, `es_editorial = true`, `user_id = null`). Nunca null.
El código lo busca por slug + `es_editorial`, no por UUID fijo.

**Migración `20261003205430_fecha_publicacion_y_editorial_admin`:**
- `fecha_publicacion timestamptz not null default now()`, rellenada con
  `created_at` (las 8 conservan su fecha visible; efecto colateral: su
  `updated_at` quedó en 2026-10-03 por el trigger de updated_at).
- **`publicaciones_insert_admin`**: antes el admin NO podía insertar.
- Trigger `publicaciones_fecha_publicacion`: artista INSERT → fecha = now();
  artista UPDATE de la fecha → 42501; pasar a `publicada` sin tocar la fecha →
  now() (también al aprobar en moderación); fecha futura → 22007 (no hay
  programación). La service role pasa intacta.

**Código:**
- `components/publicaciones/PublicacionForm.tsx` (movido desde el panel) con
  `modo: "artista" | "editorial"`. Editorial: firma MuzikChile, titular 200
  (`TITULAR_MAX_EDITORIAL`), campo fecha, "Guardar borrador"/"Publicar"; ya
  publicada → "Pasar a borrador"/"Guardar cambios". La fecha solo se envía si
  el admin la tocó (si no, el datetime-local sin segundos parecería un cambio
  manual y el trigger no pondría now() al publicar).
- `/admin/publicaciones/nueva`, `/admin/publicaciones/[id]/editar` (solo
  editoriales; las de artistas se moderan, no se editan), botón "Nueva
  noticia" y "Editar noticia editorial" en la lista.
- Portada, `/noticias`, `/noticias/[slug]` y sitemap ordenan y muestran por
  `fecha_publicacion`. El sitemap ahora incluye /noticias y cada nota.
- `scripts/migrar-noticias-channel.mjs`: mapea a `fecha_publicacion` y acepta
  `--slug=`. Café Rock migrada con fecha 2026-09-28 19:23.

**Verificado:** `verificar:rls` 14/14 (nuevos: g–n), `verificar:rls-storage`
10/10, build OK, flujo en local con admin de prueba (crear borrador → publicar
borrador viejo → fecha = now), todo limpiado.

**Pendientes:**
- **Chinoy y MUDA** (27-09) siguen solo en el Channel: correr el script sin
  `--slug` si se quieren.
- El modal de moderación del admin muestra el cuerpo como HTML crudo
  (`<p>…`); es previo a esta tanda.
- Decidir si el admin del Channel se deja de usar para noticias (hoy hay dos
  tablas que no se sincronizan).
- Regenerar `supabase/schema_baseline.sql` (pg_dump, lo corre Claudio).

---

## 🚀 Lanzamiento: www.muzikchile.cl — HECHO (2026-10-11)

tienda.muzikchile.cl pasó a ser **www.muzikchile.cl** (canónico; la raíz
redirige 308 a www). El Channel quedó en **tv.muzikchile.cl**. Pasos 1–7 del
lanzamiento completados el 11-oct-2026; el sitio es indexable.

### Qué quedó en producción
- **Dominios** (Vercel): www y la raíz en el proyecto de la Tienda; tv. en el
  Channel. `NEXT_PUBLIC_URL=https://www.muzikchile.cl`.
- **Redirects** (`next.config.ts`): tienda. → www salvo `/api` (webhooks de MP
  con el host viejo), `/?categoria=` → `/tienda?categoria=`, `/tv`,
  `/bootstrap-admin`, `/reset-password` y `/admin/settings` → tv.,
  `/admin/noticias/*` → `/admin/publicaciones` (302). Verificados en producción.
- **SEO**: `metadataBase` = www; canonical y `og:url` en portada, `/tienda`,
  `/noticias`, `/noticias/[slug]`, `/artista/[slug]`, `/producto/[id]`,
  `/contacto` y `/privacidad`. **Noindex global quitado**; las rutas privadas
  (`/panel`, `/admin`, `/checkout`, `/carrito`, `/login`, `/registro`,
  `/recuperar`) mantienen el suyo. `app/robots.ts` es el único robots.txt;
  sitemap en www (home, /tienda, /noticias, noticias y artistas).
- **Channel** (repo muzik-channel, `main`): canonical/OG de `/` y `/tv` en tv.;
  noticias con canonical a www (mismo slug); sitemap de tv. sin noticias; el
  reproductor solo acepta `muzik_pause`/`muzik_play` de su propio origen, www y
  tienda. (quitar tienda. cuando ese host solo redirija).
- **Noticias**: 500 de `/noticias/[slug]` resuelto (5bd17be): jsdom vía
  `isomorphic-dompurify` daba `ERR_REQUIRE_ESM` en Vercel; `lib/sanitizar.ts`
  usa `sanitize-html` con la misma allowlist (`npm run verificar:sanitizacion`,
  15/15). Las 11 noticias del Channel están migradas con el mismo slug.
- **Navegación**: fuera Convocatorias, Artistas, Términos y Despachos (daban
  404); nueva `/contacto` con `hola@muzikchile.cl` (`CORREO_CONTACTO`, también
  en `/privacidad`).
- **`/recuperar`**: `/registro` ya no descarta la sesión que el cliente PKCE
  canjea solo al inicializarse. Supabase Auth acepta www en Redirect URLs.
- **Claves de Supabase rotadas** (formato `sb_publishable_`/`sb_secret_`,
  legacy desactivadas); los 3 tests de RLS pasan con las nuevas.

### Acceso artistas — rediseño (2026-10-11)
- `/login` (opción 2A: formulario + mosaico de beneficios; carrusel en móvil), `/recuperar` (con "Reenviar el enlace" y espera de 60 s) y `/registro` (requisitos en vivo, variante invitación/recuperación, enlace vencido) con el diseño de Claude Design "Acceso Artistas". Solo UI: la lógica de auth no cambió (el bloque de verificación de `/registro` es idéntico línea a línea).
- Paleta nueva como tokens globales `--tema-*` (ver CLAUDE.md). El resto del sitio no cambió de colores.
- Fotos del mosaico opcionales: `public/acceso/{ficha,tienda,noticias,senal}.webp` (se detectan en el build; sin archivo, solo degradado).
- Pendiente: login real con admin (→ `/admin`) y con credenciales malas, hecho por Claudio.

### Pendiente
- **En 2–4 semanas (≈ 25-oct a 8-nov-2026)**: convertir tienda.muzikchile.cl
  en **redirect de dominio en Vercel** (→ www). Antes no: hoy `/api` de tienda.
  sigue respondiendo para los webhooks de MercadoPago de preferencias creadas
  con el host viejo (pagos pendientes, p. ej. en efectivo). Al hacerlo, quitar
  también el redirect por `host` de `next.config.ts` y `tienda.muzikchile.cl`
  de `ALLOWED_PARENT_ORIGINS` en el reproductor del Channel.
- Probar `/recuperar` de punta a punta con un correo real (el camino `?code=`
  solo se probó por código; hash y token_hash sí, en local).
- Confirmar: Site URL de Supabase Auth en www, secret `SITE_URL` de
  `invitar-artista`, Redirect URLs del Supabase del Channel con tv., y el
  webhook del panel de MercadoPago (si hay uno) en www.
- Enviar el sitemap de www a Search Console.
- Edge Functions `sitemap` y `llms` del Channel: actualizadas en el repo pero
  se despliegan aparte (`supabase functions deploy sitemap llms`).
- Lovable empuja directo a `main` del Channel: revisar que no reintroduzca
  `https://muzikchile.cl` en canonicals.

---

## 📊 Google Analytics 4 — 2026-10-13

- Mismo ID que el Channel (`G-V78FLFM201`, GA4, hardcodeado en
  `muzik-channel/index.html`, que se deja igual). Las visitas de www y tv caen en la
  misma propiedad; se separan por nombre de host.
- `components/Analitica.tsx` con `next/script` (sin `@next/third-parties`). Se
  monta en `app/(publico)/layout.tsx` y no en el layout raíz, así la etiqueta no
  sale en el HTML de /admin ni /panel.
- Solo se renderiza si `VERCEL_ENV === "production"` y existe `NEXT_PUBLIC_GA_ID`
  (en Vercel, cargada solo para Production).
- Las rutas privadas (/admin, /panel, /checkout/**, /carrito, /login, /registro,
  /recuperar) no se miden: usa `window['ga-disable-<ID>']`, que se recalcula en
  cada pushState/replaceState/popstate, antes de que GA reaccione.
- Los page_views de la navegación cliente los cuenta la medición mejorada de GA4
  (historial del navegador). No hay page_view manual.
- `/privacidad`: sección "Analítica" con links a la política de Google y al
  complemento de exclusión.

### Pendiente
- Después del deploy: comprobar que hay `collect?en=page_view` al navegar
  `/` → `/noticias` y que no hay ninguno al entrar a `/login` o `/carrito`.
- Revisar en GA4 → Flujo de datos web que "Cambios de página según el historial
  del navegador" esté activo.
- Legal: con visitas de la UE, el RGPD probablemente exige un aviso de cookies con
  consentimiento previo, que hoy no existe.

---

## 🖼️ Subir imagen en noticias editoriales — 2026-10-14

- `PublicacionForm` en modo **editorial** (admin): el dropzone se cambió por un
  campo de URL (manual) + botón "Subir imagen". Acepta JPG/PNG/WEBP de hasta 5 MB,
  comprime con `comprimirImagen` (1200px), sube al instante al bucket `noticias`
  (`<timestamp>-<nombre-limpio>.jpg`), llena la URL y muestra la vista previa 4:5.
  Los errores se muestran inline bajo el campo.
- El modo **artista** (panel) no cambió: dropzone, sube al guardar, bucket `productos`.
- Migración `20261014212954_bucket_noticias.sql`: bucket público (5 MB, mimes de
  imagen), lectura pública, escritura/edición/borrado solo admin (`has_role`).
- `lib/storage.ts`: `rutaDesdeUrlPublica` ahora devuelve `{ bucket, ruta }` y
  reconoce `productos` y `noticias`, para que borrar una nota borre su imagen.
- `lib/imagenes-remotas.ts`: la lista de `remotePatterns` vive ahí (la importa
  `next.config.ts`). `ImagenNoticia` usa `unoptimized` para URLs de otros hosts:
  sin eso, una URL externa pegada a mano tumbaba la portada (next/image lanza).

### Pendiente
- `npx supabase db push` + regenerar tipos (no se aplicó todavía).
- Probar en el admin: subir, error por >5 MB, URL manual externa en la portada.
- Una imagen subida y luego reemplazada/quitada antes de guardar queda huérfana
  en el bucket.
- `scripts/verificar-rls-storage.mjs` no cubre el bucket `noticias`.

### Imágenes dentro del cuerpo (editor TipTap) — 2026-10-14
- `lib/subir-imagen-noticia.ts`: la subida al bucket `noticias` (validación,
  `comprimirImagen`, nombre único, `getPublicUrl`) vive acá; la usan el campo de
  portada y el editor.
- `EditorContenido` recibe `subirImagen` (solo lo pasa el modo editorial): el
  botón de imagen abre el selector de archivos y se aceptan imágenes pegadas o
  arrastradas; inserta con `setImage({ src, alt })` (alt sale del nombre del
  archivo). `onSubiendoChange` bloquea el guardado mientras sube.
  Sin la prop (panel del artista) sigue el `window.prompt` de URL.
- `lib/sanitizar.ts`: `<img>` solo con `src` https de los hosts de
  `lib/imagenes-remotas.ts` + `alt`, `width`, `height` (numéricos). Una `<img>`
  con otro `src` se borra entera (antes pasaban http, data: y cualquier host).
  `href` quedó solo en `<a>`. Casos 12–18 y dos legítimos nuevos en
  `npm run verificar:sanitizacion` (23/23).
- `tsconfig.json`: `allowImportingTsExtensions`, para que `sanitizar.ts` importe
  `./imagenes-remotas.ts` y el script de Node lo pueda cargar.
- Al 2026-10-14 ninguna de las 12 publicaciones tenía `<img>` en el cuerpo: el
  cambio no borra nada publicado.

- Artistas (misma tanda): el editor también sube, a
  `productos/{artistas.id}/publicaciones/` (`destinoImagenPublicacion`), con las
  mismas reglas. Sin cambios en la base: lo permite `productos_insert_own`.
- Alt editable: clic en una imagen del editor la selecciona y abre un panel con
  su texto alternativo (arranca con el nombre del archivo).
- `lib/imagenes-remotas.ts`: el Supabase de la tienda también quedó limitado a
  `/storage/v1/object/public/**` (afecta sanitizador, next/image e
  `ImagenNoticia`); además se rechaza un puerto explícito. Revisado: ninguna URL
  guardada de ese host cae fuera. Script: 25/25.

- Portada del artista: ahora usa `subirImagenNoticia` (5 MB, compresión, su
  carpeta en `productos`). Sigue subiendo al guardar; el dropzone rechaza >5 MB
  al soltar.
- Revisado (2026-10-14): nada en el código genera URLs de Supabase fuera de
  `/storage/v1/object/public/` (sin createSignedUrl, render/image ni transform
  en getPublicUrl). next/image solo se usa en `Logo` (local) e `ImagenNoticia`
  (con fallback `unoptimized`). Los thumbnails de VideosDestacados son `<img>`.

### Pendiente
- Aplicar la migración del bucket `noticias` (`npx supabase db push`) y
  regenerar tipos. Sin eso, la subida del admin falla.
- Probar en el navegador: subida admin y artista (botón, pegar, arrastrar),
  editar alt, rechazo >5 MB.
- Las imágenes del cuerpo no se borran del Storage al borrar la publicación
  (`borrarImagenDePublicacion` solo borra la portada).

### Estado al 2026-10-15
- **Tanda commiteada**, sin push ni deploy: `e541987` (código + migración) y
  el commit siguiente (casos de `noticias` en `verificar:rls-storage` y este
  PROGRESS).
- **Migración `20261014212954_bucket_noticias` aplicada** con `db push` (el 403
  del CLI era la sesión de otra cuenta; se resolvió con login de la cuenta
  dueña). El bucket responde. `types.ts` regenerado: idéntico byte a byte
  (Storage no está tipado), sin cambios que commitear.
- **`verificar:rls-storage` cubre `noticias`**: casos (k) anónimo sube →
  rechazado, (l) artista sube → rechazado, (m) admin sube → permitido,
  (n) lectura anónima por URL pública y por `download()` → permitido,
  (o) admin sube 5 MB + 1 byte → rechazado por el límite del bucket, (p) admin
  sube SVG y HTML → rechazados por `allowed_mime_types`. **16/16**, limpieza
  sin restos (la raíz de `noticias` queda barrida por prefijo `rlstest-`).
- Falta: deploy (`vercel --prod`) y la prueba en navegador.
- Verificado: `tsc --noEmit` limpio, `npm run verificar:sanitizacion` 25/25.
- `scripts/reset-password.mjs` (**versionado desde 2026-10-19**, `3ecc2ed`;
  antes estaba en `.gitignore`): cambia la contraseña de un usuario de Auth con la service role
  (`node --env-file=.env.local scripts/reset-password.mjs <email>`). No tiene
  claves en el código: lee URL y service role de `.env.local`. Había entrado
  por error en el commit de la tanda; se reescribió antes del push.
  Pide la contraseña oculta por TTY, nunca por argumento ni env; en Git Bash
  anteponer `winpty`. Correrlo en una terminal propia, no en un chat.

---

## 🛍️ Rediseño de la tienda (Claude Design · "Tienda Pantalla") — 2026-10-19

Variación de tarjeta elegida: **A**. Solo UI: carrito, cupones, MercadoPago,
stock, RLS y consultas quedan intactos. Un commit por fase.

- ✅ Fase 0 — `scripts/reset-password.mjs` versionado (`3ecc2ed`).
- ✅ Fase 1 — Catálogo `/tienda` (`8abc5b9`): `components/tienda/TarjetaProducto`
  y `PlaceholderProducto`, barra de filtros plegable en móvil. Tokens nuevos
  `--tema-texto-claro`, `--tema-precio`, `--tema-azul-etiqueta`. Solo
  `?categoria=` va en la URL (región, tipo, orden y búsqueda son estado local,
  como antes).
- ✅ Fase 2 — `/producto/[id]` (`fa26014`, `8ffcc81`). El selector de cantidad
  ahora se respeta (`agregar()` + `actualizarCantidad()`, sin tocar el store,
  con tope en el stock); antes siempre agregaba 1. Lectura extra:
  `artistas.verificado`/`generos` y `tipo` en relacionados (sello, género,
  badge Digital). `components/tienda/SelloVerificado`.
- ✅ Fase 3 — `/artista/[slug]` con pestañas Productos / Noticias / Sobre.
  Noticias: `traerNoticiasDeArtista(artistaId)` en `lib/noticias.ts` (mismo
  cliente anon y filtros que `traerNoticias`; lanza ante error), llamada desde
  `page.tsx` en el servidor. Portada con degradado del `color_acento` (no hay
  columna de foto de portada). Se elimina `components/ui/ProductCard`.
  Hoy ningún artista real tiene noticias (las 12 son de la cuenta editorial),
  ni `verificado = true`: esos estados se probaron con datos inyectados solo
  en el navegador de prueba.
- ✅ Fase 4 — Drawer, `/carrito` y `/checkout` (`df6289c`). Esquema Zod,
  `validarCupon`, `calcularDescuento` y `onSubmit` idénticos línea a línea. El
  payload a `crear-preferencia` se comparó **byte a byte** antes/después en
  dos casos (cupón `FANS20`; sin cupón ni teléfono), interceptado en el
  navegador sin enviarse. Región pasa a `<select>` con `REGIONES_CHILE` (sigue
  siendo string). `components/tienda/carrito-ui.tsx`; `sheet.tsx` gana el prop
  opcional `overlayClassName`.
- ✅ Fase 5 — `/checkout/exito` y `/checkout/pendiente` con
  `components/tienda/ResultadoPago`. Éxito conserva `limpiar()` solo con
  `status=approved`, el N° de pedido (primer bloque del `external_reference`)
  y el Payment ID. Pendiente ahora lee `external_reference` (solo para mostrar
  el N° de pedido) y no vacía el carrito. Sin resumen del pedido: exigiría
  leer `ordenes` desde el cliente. `/checkout/error` sigue con el diseño viejo
  (fuera de alcance).
- Tokens agregados en total: `--tema-texto-claro`, `--tema-precio`,
  `--tema-azul-etiqueta`, `--tema-aviso`, `--tema-aviso-texto`, `--tema-ok-texto`.
- Textos del diseño que **no** se usaron por no tener respaldo en la lógica:
  despacho fijo $3.990, "Starken/Chilexpress 3 a 6 días", "reservamos tus
  productos 48 h", "te enviamos el comprobante", "los artistas ya fueron
  avisados", foto de portada del artista.

### Pendiente
- **Probar en producción hasta la pantalla de MercadoPago** (sin pagar):
  /tienda → agregar → drawer → checkout con cupón → "Ir a pagar" debe abrir
  MercadoPago con el total descontado.
- `/checkout/error` sin rediseñar.
- `npm run lint`: 11 errores, todos previos al rediseño (setState en effects
  en carrito/checkout/drawer/admin, `window.location.href` en checkout,
  componentes creados en render en `admin/configuracion`).

`TIENDA_VISIBLE` sigue en `false` (`components/layout/nav-links.ts`): la tienda
no aparece en Header ni Footer. El rediseño no cambia eso.

---

## 📰 Noticias: editorial vs. comunidad + revalidación bajo demanda — 2026-10-20

**Diagnóstico previo:** las notas de artistas aprobadas *ya* salían en `/` y
`/noticias` (`traerNoticias` nunca filtró por `es_editorial`). El "no aparece"
era el ISR de 5 min: aprobar no invalidaba nada.

- **`POST /api/revalidar-noticias`** `{ id }`: comprueba rol admin en el
  servidor (cookies + `user_roles`), busca slug de la nota y del autor, y
  revalida `/`, `/noticias`, `/sitemap.xml`, `/noticias/<slug>` y
  `/artista/<slug>` (si no es editorial). Lo llaman, vía
  `lib/revalidar-noticias.ts`: aprobar, despublicar y borrar (ANTES del delete)
  en `/admin/publicaciones`, y publicar/editar en `PublicacionForm` editorial.
  Nunca bloquea: si falla, toast de aviso y queda el ISR de 5 min de respaldo.
- **`lib/noticias.ts`**: `traerNoticias({ limite, origen })` (filtro por
  `artistas!inner(...).es_editorial`), tipos `OrigenNoticia` / `AutorNoticia`,
  helper `origenNoticia()`, y `.eq("visibilidad", "publica")` explícito.
- **`components/noticias/`**: `FirmaNoticia` (editorial = logo + "Redacción
  MuzikChile" sin enlace; artista = foto + nombre + sello + enlace a su ficha),
  `BadgeComunidad`, `ListadoNoticias` (chips Todas/Editorial/Comunidad por
  `?origen=`, filtrado en cliente para conservar el ISR).
- Tarjetas de portada y `/noticias` pasaron de `<Link>` entero a `<article>` con
  enlace estirado (`ENLACE_ESTIRADO`), para que la firma pueda enlazar sin
  anidar `<a>`.
- **Portada**: destacada = editorial más reciente; fila = 4 recientes sin la
  destacada, recortadas a 3.
- RLS y esquema sin cambios.

### Pendiente
- **Probar la vista "Comunidad" con datos reales**: la nota de Valentina Ruz se
  borró de la base durante esta sesión, así que hoy hay 0 notas de comunidad y
  el badge, la firma de artista y el chip "Comunidad" no se vieron renderizados
  con una nota real.
- Probar en producción que aprobar una nota la muestra al instante en `/`.

---

## 🔑 /login: opción 3A del diseño (sin fotos, texto + marquesinas) — 2026-10-22

- `components/acceso/beneficios.tsx` reescrito: `PanelBeneficios` (columna
  derecha en desktop: grilla, halos, marquesina arriba y abajo, 4 beneficios
  numerados en Anton 34px) y `ListaBeneficios` (móvil/tablet, bajo el
  formulario). Reemplazan al mosaico y carrusel de la 2A; sale la lógica de
  fotos opcionales de `public/acceso/` (la carpeta nunca existió).
- Textos nuevos de los beneficios (Tu perfil, gratis · Tu tienda · Tus
  noticias · En la señal). Marquesina inferior: "Tu perfil" en vez de "Tu ficha".
- `/login` a dos columnas iguales y a todo el ancho. Formulario intacto.
- Marquesinas: `.marquesina-pista` en globals.css, quietas con
  `prefers-reduced-motion`, `aria-hidden`.
- Verificado a 375/768/1280/1920: sin scroll horizontal, marquesinas se mueven
  y se detienen con movimiento reducido, contraste ≥5.95:1 sobre el fondo real.

### Pendiente
- ✅ La bajada del formulario pasó de "ficha" a "perfil" (2026-10-22).

---

## 🎬 Portada: bienvenida y videos destacados del diseño — 2026-10-21

- **`_portada/Bienvenida.tsx`** (Server Component): kicker "Vitrina de la
  escena independiente", H1 en 2 líneas (Anton 400, `clamp(40px, 7vw, 76px)`),
  bajada nueva y cifras. Sin la línea de horizonte (pasa directo a los videos).
  Gris de kicker y etiquetas en `tema-texto-3` (el #7A7A7A del diseño no llega
  a AA a 11–12px). Sin barras de ecualizador.
- **`lib/cifras-channel.ts`**: artistas distintos, ciudades distintas y videos
  activos desde el Supabase del Channel, `revalidate: 300`. Si falla →
  `null` y no se muestran cifras. Ciudades: normaliza tildes/mayúsculas,
  descarta vacíos y "Región …", une errores de tipeo (≤2 letras). Formato
  "240+" (decena hacia abajo). Hoy: 240+ · 30+ · 260+.
- **`VideosDestacados`**: tarjetas del diseño (miniatura 16:9, badge azul de
  ciudad, play rojo en hover/foco y siempre en táctil, artista en Anton),
  "VIDEOS" fantasma y halo azul. Modal y `silenciar`/`restaurar` sin cambios.
  Sin filtros por ciudad ni "Ver todos" (decisión del usuario).
- Verificado a 375/768/1280/1920: sin scroll horizontal, Hero igual, modal
  abre y cierra con Escape. Contraste peor píxel ≥4.79:1.

### Pendiente
- `videos.ubicacion` del Channel tiene errores de tipeo ("Santiafo de Chile")
  y valores raros ("Dash", "Holanda"): se ven tal cual en el badge y afectan
  la cifra de ciudades. Arreglarlos en los datos del Channel.
- En 375 el kicker se parte en 2 líneas, y "ESCENA" y "VIDEOS" fantasma quedan
  casi pegadas detrás del título de videos.

---

## 🌌 Portada: fondo con atmósfera en la bienvenida — 2026-10-21

- **`app/(publico)/_portada/BienvenidaFondo.tsx`** (Server Component, estático):
  degradado #1C1C1C → #161616, grilla de 72px con máscara radial, halo rojo
  central, halo azul abajo a la derecha, "ESCENA" fantasma en contorno
  (`clamp(96px, 22vw, 300px)`; el mínimo de 140 del diseño se cortaba a 375)
  y línea de horizonte al pie. Sin animaciones; el grano sigue siendo el de
  `GrainOverlay`.
- La sección "Conecta" de `page.tsx` pasó a banda propia: padding 64/72px en
  móvil y 88/96px en desktop (antes `pt-24 pb-4`, pegada a Videos destacados).
  Titular y bajada sin cambios.
- Verificado a 375/768/1280/1920: sin scroll horizontal, el Hero mide lo mismo.
  Contraste con píxeles reales: titular ≥13.2:1 y bajada ≥5.29:1 sobre las
  capas nuevas.

### Pendiente
- El grano de `GrainOverlay` (opacidad 0.12) deja motas sueltas que, en el
  peor píxel, bajan la bajada a 4.43:1 en 375. Era así antes de este cambio;
  evaluar bajar la opacidad.

---

## 🎨 Portada y noticias: de #000 a la paleta tema — 2026-10-21

- Portada, `/noticias`, `/noticias/[slug]`, `/contacto` y `/privacidad` (y sus
  componentes: `_portada/*`, `components/noticias/*`, `ContenidoNoticia`,
  `EmbedInstagram`) dejaron `C.negro`/`C.negroSuave`/`C.borde`/`C.gris*` por
  `TEMA` (nuevo en `lib/portada.ts`, puente a las `--tema-*`):
  fondo `#161616`, tarjetas y sección de noticias `#1C1C1C`, bordes `#2A2A2A`,
  grises `tema-texto-2/-3/-claro`. Los rojos de marca de `C` no se tocaron.
- Contraste: "Leer nota completa" pasó de `#CC0000` a `tema-rojo-texto`, y los
  enlaces de `/privacidad` de `#2C567F` a `tema-azul-texto`.
- Auditoría automática (cada texto visible vs. su fondo efectivo, WCAG AA) en
  las 5 páginas a 375 y 1280: **25 textos bajo AA antes → 0 después**. Los 25
  ya fallaban sobre el negro (fechas `#555`, el rojo y el azul de arriba).

- **Footer** (después, mismo día): token nuevo `--tema-fondo-profundo`
  (`#111111`, `TEMA.fondoProfundo`), un escalón bajo la página y sin #000.
  Bordes `tema-borde`, enlaces `tema-texto-2`, copyright `tema-texto-3`
  (antes `#555`, 2.8:1). Auditoría: 9/9 textos del Footer en AA.
- **Migas de pan** de `/tienda`, `/carrito`, `/checkout` y `/producto/[id]`
  quedaban a 2px de la cápsula en móvil (6px en desktop). Ahora usan
  `--aire-bajo-header`: 16px en móvil y 20px desde 768 (medido).

### Pendiente
- `ImagenNoticia` mantiene `#141414` de fondo en el recuadro de la imagen.

---

## 🧭 Header público: cápsula flotante — 2026-10-21

- **`components/layout/Header.tsx`** reescrito (diseño de Claude Design): cápsula
  de vidrio sticky (máx. 1300px, 62px, a 14px del borde), logo SVG oficial +
  "CHILE", menú segmentado ≥1024px con punto rojo y `aria-current` en el activo,
  carrito, separador ≥1080px y CTA "Acceso artistas" (↗), que entre 1024 y
  1080px se acorta a "Artistas". Bajo 1024px: hamburguesa + panel desplegable
  que cierra con Escape (devuelve el foco), clic fuera y al navegar.
  - El menú sale de `NAV_LINKS` (Inicio, Noticias; Tienda solo con
    `TIENDA_VISIBLE`). Sin botón de búsqueda: no hay buscador global.
  - Contenedor sticky en `top: 0` (no 14px) para que la cápsula no baje 14px al
    hacer scroll.
- **El header viejo pasó a `HeaderPanel.tsx`**, solo para /panel y /admin (su
  `Sidebar` depende de los 64px).
- `CarritoDrawer` tiene `variante="capsula"` (botón 42×42/44 con bolsa y badge);
  el drawer y el store no cambiaron. `Logo` acepta `children`.
- Tokens nuevos en `globals.css`: `tema-activo`, `tema-texto-tenue`,
  `tema-rojo-hover`, `tema-foco`, y las medidas `--alto-header` (62px) y
  `--header-ocupa` (76px). `/login`, `/recuperar` y `/registro` usan
  `calc(100dvh - var(--alto-header))`; los resúmenes sticky de `/carrito` y
  `/checkout`, `top: calc(var(--header-ocupa) + 24px)`; `<html>` tiene
  `scroll-padding-top: var(--header-ocupa)`.
- El layout `(publico)` lleva `bg-tema-fondo` (el `<body>` es blanco y se veía
  a través del vidrio).
- Verificado con build de producción a 375, 768, 1024, 1080, 1280 y 1920 en `/`,
  `/noticias`, `/tienda` y `/login`: sin scroll horizontal ni desborde de la
  cápsula.

### Pendiente
- ✅ Resuelto en el commit siguiente: las páginas en `#000` se pasaron a
  `tema-fondo` (ver abajo).
- `CarritoDrawer` tiene un error de lint previo (`set-state-in-effect` en
  `setMontado`), y `PanelShell` una variable sin usar; los dos son anteriores a
  este cambio.

---

## 📸 Noticias: embeds de Instagram — 2026-10-21

- **Botón "Instagram"** en la barra de `EditorContenido` (lo usan el panel del
  artista y el admin editorial vía `PublicacionForm`). Acepta `/p/`, `/reel/` y
  `/tv/` (→ `p/`), con o sin `www`/`m.`, `?igsh=`, `?utm_source=`, `#…` o
  `/usuario/` antes del tipo. Inserta `[instagram:p/CODIGO]` o
  `[instagram:reel/CODIGO]`.
- **`lib/embed-instagram.ts`** (sin imports, lo importa el test con Node):
  `validarInstagram` (host exacto `instagram.com`/`www.`/`m.`, https, sin
  userinfo ni puerto; código `[A-Za-z0-9_-]{5,64}`), `urlInstagram`,
  `urlPostInstagram`. Reemplaza al `validarUrlDe(["instagram.com"])` de
  `lib/embeds.ts`: los `[instagram:URL]` migrados del Channel pasan por el mismo
  validador y ahora se ven como embed en vez de enlace.
- **`components/contenido/EmbedInstagram.tsx`** (isla cliente) — *reemplazado
  el 2026-10-22 por la carga perezosa sin clic, ver la sección siguiente*: tarjeta
  "Publicación/Reel de Instagram" con "Cargar publicación" + "Ver en Instagram";
  el iframe a `/embed/captioned/` se monta recién al clic (verificado: 0
  peticiones a Meta antes). Ancho máx. 540px; alto por los mensajes `MEASURE`
  del iframe (filtrados por origen y `source`). Sin `MEASURE` en 10 s (post
  borrado/privado/sin inserción) → se retira el iframe y queda "No se pudo
  mostrar la publicación aquí" + enlace. El enlace "Ver publicación en
  Instagram" queda siempre bajo el iframe. `sandbox` sin `allow-top-navigation`.
- `lib/sanitizar.ts` sin cambios: iframes y scripts siguen prohibidos en el
  HTML. `verificar:sanitizacion` suma 2 ataques (código oficial
  blockquote+embed.js, iframe pegado) y 24 casos del validador → 51/51.
- Los paths de iconos de marca salieron del Footer a
  `components/layout/iconos-marca.ts` (`PATHS_MARCA`), para reutilizarlos.
- Probado en local con un post real (`natgeo/p/DeuOR-CjKE9`), un reel real
  (`instagram/reel/DecLR_vvrW6`) y un código inexistente, a 375 y 1280, con
  Chrome headless por CDP (las capturas de la extensión de Chrome se colgaban).

### Pendiente
- Probar el botón del editor en el panel con sesión real (no se probó la UI
  del editor: requiere login; la validación es la misma función ya cubierta
  por el test).
- TikTok y X siguen como enlace (`EmbedEnlace`).

---

## 📸 Instagram sin clic + YouTube nocookie — 2026-10-22

- **`EmbedInstagram` carga solo**: sale la tarjeta "Cargar publicación". El
  iframe se monta cuando el bloque entra a 300px de la pantalla
  (IntersectionObserver, `rootMargin: "300px 0px"`), no al abrir la página.
  Mientras tanto, y hasta el primer `MEASURE`, un esqueleto (`Esqueleto`:
  cabecera, cuadrado con el ícono, dos líneas; `motion-safe:animate-pulse`)
  ocupa los mismos 640px iniciales. Se mantienen el ajuste de alto por
  `MEASURE` y el enlace "Ver publicación en Instagram" siempre visible; el
  plazo sin medida baja de 10 s a **8 s** → "No se pudo mostrar…" + enlace.
- **YouTube a `www.youtube-nocookie.com`**: `urlYoutube` (`lib/embeds.ts`,
  embeds de noticias) y el modal de `VideosDestacados` en la portada. Las
  miniaturas siguen en `img.youtube.com` (imágenes, sin cookies). No hay CSP
  `frame-src` que actualizar.
- Probado en local con Chrome headless por CDP (página temporal, ya borrada):
  al abrir, 0 iframes y 0 peticiones a Meta; a ~370px del bloque, todavía 0;
  al acercarse, esqueleto de 640px → post real (`natgeo/p/DeuOR-CjKE9`)
  ajustado a 1150px; código inexistente → mensaje + enlace a los 8 s.

### Pendiente
- El esqueleto mide 640px y un post con texto largo mide ~1150: al llegar la
  medida el bloque crece y empuja lo de abajo (pasa fuera de pantalla casi
  siempre, porque carga 300px antes). Si molesta, subir `ALTO_INICIAL`.
- Instagram ahora deja cookies **sin consentimiento previo** → ver el aviso de
  cookies en "Siguiente (prioridad)".

---

## 🏷️ Noticias: categorías Lanzamientos · Tocatas · Escena — 2026-10-22

**Diagnóstico:** `publicaciones.categoria` era `text` sin CHECK. Había 12
noticias: 11 `general`, 1 `lanzamiento`, 0 `prensa`, 0 `show`. No hubo datos
que migrar.

- **Valores guardados intactos, cambian las etiquetas** (`CATEGORIAS_NOTICIA`
  en `lib/publicaciones.ts`): `lanzamiento` → Lanzamientos, `show` → Tocatas,
  `general` → Escena. Sale `prensa`. El formulario (artista y editorial) y los
  badges heredan solos vía `etiquetaCategoria`.
- **Migración `20261022135939_categoria_noticia_check`**: CHECK
  `tipo <> 'noticia' OR (categoria IS NOT NULL AND categoria IN
  ('lanzamiento','show','general'))`. Solo noticias: convocatorias y fechas
  abiertas quedan libres. El `IS NOT NULL` cierra el hueco de NULL (sin él,
  `NULL IN (...)` pasa el CHECK). Los types no cambian.
- **`/noticias`**: el filtro pasó de Editorial/Comunidad (`?origen=`) a
  Todas · Lanzamientos · Tocatas · Escena (`?categoria=<valor>`), filtrado en
  el cliente, sin tocar el ISR. `?origen=` se ignora (cae en "Todas"). El badge
  Comunidad y la firma siguen en cada nota.
- **Rojo `tema-rojo`** en vez de `C.rojo` (#CC0000): chip activo (texto
  `tema-texto` #EDEDED sobre #B02F3C = 5.41:1, AA), pills de categoría
  (borde `tema-rojo`, texto `tema-rojo-texto`) en `/noticias` y la nota, y el
  badge de la portada. Nuevo `TEMA.rojo` en `lib/portada.ts`.
- Test RLS: caso **(o)**, un artista inserta una noticia con `'prensa'` →
  rechazada con 23514 (CHECK, no RLS); caso **(p)**, lo mismo con categoría
  NULL.

### Ajuste del vocabulario — 2026-10-22 (antes del `db push`)

Según el contenido real, cinco categorías: `lanzamiento` → Lanzamientos
(singles, discos), **`video` → Videoclips** (nueva: estreno de un
videoclip), `show` → **En vivo** (antes "Tocatas": festivales, ciclos,
tocatas, sesiones), **`perfil` → Perfiles** (nueva: presentar a un artista
o banda), `general` → Escena (análisis, curaduría, industria).

- **Se editó la migración `20261022135939` en vez de crear otra**: no estaba
  aplicada. Comprobado con un INSERT a propósito inválido con service role
  (`categoria 'prensa'` + `artista_id` inexistente): respondió 23503 (FK) y
  no 23514, o sea, el CHECK no existe en la DB y no se escribió ninguna fila
  (`supabase migration list` da 403 con esta cuenta). CHECK:
  `categoria IS NOT NULL AND categoria IN ('lanzamiento','video','show','perfil','general')`.
- Filtro de `/noticias`: Todas · Lanzamientos · Videoclips · En vivo ·
  Perfiles · Escena (orden de `CATEGORIAS_NOTICIA`). A 375px no caben (656px
  en 343): en móvil la fila hace **scroll horizontal** sin salto de línea ni
  scroll de página, y se desplaza sola hasta el chip activo
  (`?categoria=perfil`); desde `sm` envuelve como antes. Verificado con
  Chrome headless a 375 y 1280.
- Meta description de `/noticias` actualizada con las cinco.
- Test RLS: **(q)** `'perfil'` y **(r)** `'video'` → permitidos (las filas
  las barre `limpiar()`). El NULL rechazado ya era el caso (p).
- En la ficha del artista (`claseCategoria` de `ArtistaClient`) `video` y
  `perfil` usan el pill neutro, como `general`.

### Pendiente
- **`npx supabase db push`** y luego `npm run verificar:rls` (los casos (o) y (p) fallan
  hasta que la migración esté aplicada; (q) y (r) deben pasar).

---

## 🚧 En progreso / bugs conocidos

- ✅ **Resuelto 2026-10-19 — los chips de categoría de `/tienda` no filtraban
  nada** (bug previo al rediseño): los chips son las categorías padre (Merch,
  Música física, Colección, Digital), pero cada producto apunta a una
  subcategoría (Poleras, Cassettes, EPs…), y el filtro comparaba solo
  `p.categorias.slug === categoriaActiva` → 0 productos en cualquier chip y en
  `?categoria=merch`. Ahora la consulta trae `categorias.padre_id` y un chip
  padre incluye a sus hijas; un slug de subcategoría (`?categoria=poleras`)
  sigue filtrando solo esa.

- **Email de confirmación de compra**: no hay código de envío de email en
  ningún Route Handler. Desde el rediseño (2026-10-19) `/checkout/exito` ya no
  promete un correo propio: dice que el comprobante lo envía MercadoPago.

---

## ⏭️ Siguiente (prioridad)

⚠️ **PRIORITARIO — Aviso de cookies, antes de diciembre 2026.** Un banner de
consentimiento que controle **Google Analytics, YouTube, Spotify e Instagram**:
nada de terceros hasta que la persona acepte (GA con Consent Mode o sin cargar;
los embeds con un reemplazo + "Cargar" mientras no haya consentimiento). Hoy
GA mide de entrada, y desde el 2026-10-22 Instagram carga sin clic. Al
hacerlo, actualizar `/privacidad` (el borrador ya anticipa "cookies con
consentimiento previo; hoy no lo hay").

0. ✅ **Baseline de esquema — generado 2026-09-25**, regenerado tras la
   migración de storage, en `supabase/schema_baseline.sql` (schemas `public` +
   `storage`). Contiene las 10
   tablas (`artistas`, `productos`, `ordenes`, `cupones`, `liquidaciones`,
   `publicaciones`, `suscriptores`, `categorias`, `user_roles`, `app_settings`),
   las funciones `has_role`, `assign_artista_role`, `incrementar_usos_cupon`,
   `publicaciones_set_updated_at` y sus políticas RLS (59 en total, 14 sobre
   `storage.objects`). **Regenerarlo después de cada migración.** `npx supabase db pull` no sirve acá: exige Docker Desktop.

   Para regenerarlo (pg_dump 18 vía Scoop; no queda en el PATH, usar ruta completa):
   ```bash
   scoop install postgresql

   C:/Users/raice/scoop/apps/postgresql/current/bin/pg_dump.exe \
     --schema-only --no-owner --no-privileges --schema=public --schema=storage \
     -f supabase/schema_baseline.sql \
     "postgresql://postgres.rgskspvuvzwmvmsccoez@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
   ```
   **La URL va SIN contraseña**: `pg_dump` la pide interactivamente, así no queda
   en el historial de la terminal ni en un chat. Password en Dashboard →
   Settings → Database. Correrlo en una terminal propia (no con `!` en un chat:
   el prompt interactivo no funciona ahí).

   **Guardar como referencia, no como migración ejecutable** — por eso va en `supabase/schema_baseline.sql` y no en `supabase/migrations/`. Un archivo en `migrations/` sería marcado como aplicado por `db push` y enmascararía para siempre la ausencia del baseline real. (De hecho el `db pull` fallido de 2026-07-25 dejó una migración de 0 bytes que hubo que borrar por exactamente eso.)

   La receta usa el pooler en modo sesión (host `aws-1-us-west-2.pooler.supabase.com:5432`, usuario `postgres.rgskspvuvzwmvmsccoez`) porque la conexión directa `db.<ref>.supabase.co` es IPv6-only en proyectos nuevos. Si tu red tiene IPv6, también sirve `postgresql://postgres@db.rgskspvuvzwmvmsccoez.supabase.co:5432/postgres?sslmode=require`, igualmente sin contraseña.

1. **Confirmar con una compra real de prueba** que el descuento del cupón ahora sí llega a MercadoPago (fix ya deployado en `93a9858`)
2. **Probar flujo completo sin cupón** — confirmar que checkout sin cupón funciona 100% en producción
3. **Email transaccional** — confirmación de compra al comprador y notificación al artista
4. **WebPay / Transbank** — placeholders en `/checkout` y `/admin/configuracion`, marcados "Próximamente"
5. **Integración Spotify** — badge "Próximamente: Conectar con Spotify" en `/panel/perfil`

---

## ⚠️ Pendientes / bugs conocidos (no críticos)

- **Pendiente de negocio — el checkout no cobra envío**: no existe lógica de
  despacho. `crear-preferencia` solo guarda `direccion_envio`, `ciudad_envio` y
  `region_envio` en `ordenes`; el total que va a MercadoPago es subtotal −
  cupón, sin costo de envío para productos físicos. Hay que decidir tarifa
  (fija, por región, por artista) antes de implementarla.

- **`force-dynamic` extensivo**: múltiples layouts y pages lo usan para evitar errores de SSG en Vercel. Desactiva caching a nivel de página.
- **Guards de auth client-side**: flash de "Verificando acceso..." antes de redirigir. Considerar middleware si se optimiza UX.
- **Slug sin unicidad garantizada en código**: se auto-genera desde `user_id` al primer acceso; el artista puede cambiarlo. (verificar unique constraint en DB)
- **Cupones artista vs. globales**: misma tabla `cupones`, diferenciados por `artista_id` nulo/no nulo. Confirmar que el checkout aplica ambos tipos correctamente.

---

## 🧠 Decisiones clave

| Decisión | Razón |
|---|---|
| Guards de auth en el cliente (layout.tsx), no en middleware | Evitar complejidad con cookies de Supabase SSR en middleware; se optó por simplicidad |
| `SUPABASE_SERVICE_ROLE_KEY` solo en Route Handlers | Las páginas del artista usan anon key + RLS; el Route Handler de MP necesita acceso total para leer configuración y crear órdenes |
| Compresión de imágenes client-side (canvas) antes de subir | Reducir peso en Supabase Storage; max 800px ancho, 85% calidad JPEG |
| `force-dynamic` extensivo | Vercel generaba páginas estáticas que rompían con `useSearchParams` y auth dinámica en Next.js 16 |
| Inline styles + Tailwind conviviendo | Decisión de diseño; los tokens de color/font no están en Tailwind config, se aplican directamente |
| Descuento de cupón en `unit_price` por item (no `coupon_amount`) | `coupon_amount` de MP no reducía el precio visible; el descuento se incorpora directamente en cada `unit_price` antes de crear la preferencia |
| Comisión MuzikChile sobre precio original | El descuento del cupón lo absorbe el artista, no la plataforma |
| `notification_url` condicional a HTTPS | MP rechaza con "policy UNAUTHORIZED" si la URL es localhost/HTTP |
| No hay tests | Proyecto en etapa MVP/early |
| Único branch `main` | Desarrollo directo en main, sin feature branches |
| Deploy manual (`vercel --prod`), no auto-deploy por push a GitHub | El proyecto Vercel no tiene el repo Git conectado (confirmado 2026-06-30). `git push` a `main` NO dispara deploy — hay que correr `vercel --prod` explícitamente después de cada push |

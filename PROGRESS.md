# PROGRESS.md — MuzikChile Tienda

> Actualizado: 2026-07-27
> Branch: `main` (único branch activo)

---

## ✅ Hecho

### Catálogo público
- Home (`/`) con grid de productos, filtros sticky (categoría, región, tipo, orden, búsqueda libre)
- Ficha de producto (`/producto/[id]`)
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
- ⚠️ **Las políticas de artista y admin NO están probadas end-to-end.** Requieren
  sesión autenticada real de cada rol. La prueba concreta: entrar como artista,
  crear una publicación e intentar `update` con `estado: 'publicada'` — debe
  fallar con 42501. Y como admin, confirmar que sí ve las filas `pendiente`.
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

#### ⚠️ PENDIENTE: prueba end-to-end del RLS con sesión de artista real

**Sigue sin verificarse que un artista no pueda autopublicarse.** Lo único
probado hasta ahora es la ruta anon (SELECT `200 []`, INSERT rechazado con
42501). Las políticas de artista y admin necesitan sesión autenticada de cada
rol.

La prueba clave es sobre el `WITH CHECK` de `update_propias`: con una
publicación en `borrador` (donde el `USING` sí deja pasar), forzar desde la
consola del navegador un `PATCH` a `estado: 'publicada'`.

- **Esperado**: `42501 new row violates row-level security policy`.
- **Si en cambio devuelve la fila actualizada**, la moderación es evitable y hay
  que arreglar la política antes de construir el panel de admin encima.

Conviene también probar el aislamiento entre artistas: con una segunda cuenta,
un `PATCH` contra el id de la primera debe devolver `[]` (el RLS ni la ve), no un
error de permisos.

Los pasos exactos con el snippet de consola quedaron en el reporte de la Tanda B.

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

## 🚧 En progreso / bugs conocidos

- **Email de confirmación de compra**: la página `/checkout/exito` dice "Recibirás un email" pero no hay código de envío de email en ningún Route Handler

---

## ⏭️ Siguiente (prioridad)

0. **Baseline de esquema** (pendiente de 2026-07-25). El pipeline ya funciona
   (`crear_publicaciones` aplicada y trackeada), pero **falta la captura del
   esquema anterior a él**: `artistas`, `productos`, `ordenes`, `cupones`,
   `liquidaciones`, `categorias`, `user_roles`, `app_settings`, `has_role` y todas
   sus políticas RLS existen solo en el servidor. Para cambios aditivos no molesta;
   para alterar tablas existentes conviene tenerlo antes. `npx supabase db pull` no
   sirve acá: exige Docker Desktop, que es un elefante para esta pulga.

   Alternativa sin Docker (Windows/Scoop):
   ```bash
   scoop install postgresql

   pg_dump --schema-only --no-owner --no-privileges \
     "postgresql://postgres:[PASSWORD]@db.rgskspvuvzwmvmsccoez.supabase.co:5432/postgres" \
     > supabase/schema_baseline.sql
   ```
   Password en Dashboard → Settings → Database.

   **Guardar como referencia, no como migración ejecutable** — por eso va en `supabase/schema_baseline.sql` y no en `supabase/migrations/`. Un archivo en `migrations/` sería marcado como aplicado por `db push` y enmascararía para siempre la ausencia del baseline real. (De hecho el `db pull` fallido de 2026-07-25 dejó una migración de 0 bytes que hubo que borrar por exactamente eso.)

   Si la conexión directa falla por IPv6 (el host `db.<ref>.supabase.co` es IPv6-only en proyectos nuevos), usar el pooler en modo sesión: host `aws-0-us-west-2.pooler.supabase.com:5432`, usuario `postgres.rgskspvuvzwmvmsccoez`.

1. **Probar el RLS de `publicaciones` con sesión de artista real** — bloquea la
   tanda de moderación del admin. Si el `WITH CHECK` de `update_propias` tiene un
   hueco, el artista puede autopublicarse y la moderación entera es decorativa:
   mejor descubrirlo antes de construir el panel de admin encima. Ver el detalle
   en "Tanda B" más arriba.

2. **Confirmar con una compra real de prueba** que el descuento del cupón ahora sí llega a MercadoPago (fix ya deployado en `93a9858`)
3. **Probar flujo completo sin cupón** — confirmar que checkout sin cupón funciona 100% en producción
4. **Email transaccional** — confirmación de compra al comprador y notificación al artista
5. **WebPay / Transbank** — placeholders en `/checkout` y `/admin/configuracion`, marcados "Próximamente"
6. **Integración Spotify** — badge "Próximamente: Conectar con Spotify" en `/panel/perfil`

---

## ⚠️ Pendientes / bugs conocidos (no críticos)

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

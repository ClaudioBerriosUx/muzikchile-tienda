# PROGRESS.md — MuzikChile Tienda

> Actualizado: 2026-06-29
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
- Aplicación de cupones en checkout (validación en cliente + descuento en preferencia MP)
- Preferencia de MercadoPago (`/api/mercadopago/crear-preferencia`) con cálculo de comisiones por artista
- Páginas de resultado: éxito, error, pendiente

### Auth
- Login / registro con Supabase Auth (magic link / email)
- Auto-asignación de rol `artista` en primer acceso al panel
- Auto-creación de registro `artistas` en primer acceso

### Panel artista (`/panel`)
- Dashboard con métricas (ventas, órdenes pendientes, ingresos del mes)
- Listado de mis productos
- Subir producto nuevo (con compresión de imágenes client-side, react-dropzone, validación Zod)
- Editar producto (`/panel/productos/[id]/editar`)
- Perfil del artista: nombre, slug, bio corta + larga, foto, redes sociales (Instagram, Spotify, YouTube, TikTok, SoundCloud), color acento, datos bancarios (banco, tipo cuenta, cuenta, RUT, región/ciudad)
- Mis cupones: CRUD completo (crear, editar, activar/desactivar)
- Liquidaciones: vista de historial de órdenes y pagos recibidos (solo lectura)

### Admin (`/admin`)
- Dashboard
- Productos: revisión de productos en_revision → aprobado/rechazado, badge de pendientes en sidebar
- Artistas: listado, invitar por email, editar comisión, marcar founder, activar tienda, verificar
- Editar artista (`/admin/artistas/[id]/editar`)
- Categorías: CRUD
- Órdenes: listado con filtro por estado, cambio de estado
- Cupones globales: CRUD (equivalente al panel artista pero sin artista_id)
- Liquidaciones: vista de artistas con saldo pendiente, registro de pagos realizados
- Configuración: tokens de MercadoPago (access token, public key, modo sandbox/prod) con campos enmascarados

---

## 🚧 En progreso / incompleto

- **Webhook de MercadoPago**: no existe ruta `/api/mercadopago/webhook` visible en el código. Las órdenes se crean en estado `pendiente` pero no hay mecanismo para actualizarlas a `pagado` tras confirmación de MP. (verificar si hay una Supabase Edge Function haciendo esto)
- **Email de confirmación de compra**: la página `/checkout/exito` dice "Recibirás un email con los detalles" pero no hay código de envío de email en el Route Handler ni en el cliente
- **Console.logs de debug**: `app/admin/artistas/page.tsx` tiene `console.log("admin artistas data:", data)` y similar. Commits recientes etiquetados `debug:` indican que quedan logs de depuración en producción

---

## ⏭️ Siguiente (lo que toca)

Basado en los features marcados "Próximamente" en el código y la lógica incompleta:

1. **Webhook de MercadoPago** — implementar `/api/mercadopago/webhook` que reciba notificaciones IPN, verifique el pago y actualice `ordenes.estado` a `pagado`
2. **Limpiar console.logs de debug** — `admin/artistas/page.tsx` y cualquier otro residuo de commits `debug:`
3. **WebPay / Transbank** — placeholders en `/checkout` y en `/admin/configuracion`, marcados "Próximamente"
4. **Logística** — sección en `/admin/configuracion` marcada "Próximamente" (verificar qué cubre: envíos, tracking, etc.)
5. **Integración Spotify** — badge "Próximamente: Conectar con Spotify" en `/panel/perfil`
6. **Email transaccional** — al menos confirmación de compra al comprador y notificación al artista

---

## ⚠️ Pendientes / bugs conocidos

- **Órdenes nunca se actualizan de `pendiente` a `pagado`**: sin webhook, todos los pedidos quedan en `pendiente` indefinidamente. El panel de liquidaciones del artista muestra "pendiente de pago" aunque el cliente haya pagado.
- **`force-dynamic` en múltiples páginas**: varios layouts y pages usan `export const dynamic = 'force-dynamic'` para evitar errores de SSG en Vercel. Esto desactiva cualquier caching a nivel de página.
- **Guards de auth client-side**: el panel artista y admin protegen con `useEffect`, lo que produce un flash de "Verificando acceso..." antes de redirigir. Considerar protección en middleware si se optimiza UX.
- **`artistas` sin unicidad de slug garantizada en código**: el slug se auto-genera desde el `user_id` al primer acceso; el artista puede cambiarlo manualmente. (verificar si hay unique constraint en la DB)
- **Cupones de artista vs. cupones globales**: existen en tablas/flujos separados pero la tabla parece ser la misma (`cupones`), diferenciada por `artista_id` nulo/no nulo. Confirmar que el flujo de checkout aplica ambos correctamente.

---

## 🧠 Decisiones clave

| Decisión | Razón |
|---|---|
| Guards de auth en el cliente (layout.tsx), no en middleware | Evitar complejidad con cookies de Supabase SSR en middleware; se optó por simplicidad |
| `SUPABASE_SERVICE_ROLE_KEY` solo en Route Handlers | Las páginas del artista usan anon key + RLS; el Route Handler de MP necesita acceso total para leer configuración y crear órdenes |
| Compresión de imágenes client-side (canvas) antes de subir | Reducir peso en Supabase Storage; max 800px ancho, 85% calidad JPEG |
| `force-dynamic` extensivo | Vercel generaba páginas estáticas que rompían con `useSearchParams` y auth dinámica en Next.js 16 |
| Inline styles + Tailwind conviviendo | Decisión de diseño del proyecto; los tokens de color/font no están en Tailwind config, se aplican directamente |
| No hay tests | Proyecto en etapa MVP/early |
| Único branch `main` | Desarrollo directo en main, sin feature branches |

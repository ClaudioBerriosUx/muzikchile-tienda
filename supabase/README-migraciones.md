# Migraciones

Desde ahora **todo cambio de esquema va por migración versionada en
`supabase/migrations/`.** No se modifica el esquema desde el editor SQL del
dashboard de Supabase sin reflejarlo después en un archivo de migración.

> Este documento vive en `supabase/`, no dentro de `migrations/`, porque el CLI
> emite un warning de "Skipping migration" por cada archivo de ese directorio que
> no calce con el patrón `<timestamp>_nombre.sql`. **`migrations/` contiene solo
> migraciones.**

## Por qué

El repo operó sin migraciones ni tipos generados, y el esquema real solo se podía
inferir leyendo los queries. Eso ya causó bugs en producción por nombres de columna
incorrectos, y el patrón se repitió más de una vez:

- `cupones`: el código usaba `tipo` / `fecha_expiracion` / `monto_minimo`; las columnas
  reales son `tipo_descuento` / `expira_at`, y `monto_minimo` no existe. El descuento
  nunca llegaba a MercadoPago. (Ver PROGRESS.md, resuelto 2026-06-30.)
- `liquidaciones`: el código usaba `fecha` / `comprobante`; las columnas reales son
  `fecha_transferencia` / `numero_comprobante`. El registro de pagos fallaba en silencio.
- `artistas`: la ficha pública leía `redes_sociales`; la columna real es `redes`.

Los tres comparten la misma causa: no había una fuente de verdad del esquema dentro
del repo. `lib/supabase/types.ts` + estas migraciones son esa fuente de verdad.

## Estado actual

Migraciones aplicadas:

| Timestamp | Migración |
|---|---|
| `20260725190514` | `crear_publicaciones` — tabla `publicaciones` + 9 políticas RLS |

⚠️ **Falta el baseline**: no hay una captura versionada del esquema *anterior* a
esa migración (`artistas`, `productos`, `ordenes`, `cupones`, `liquidaciones`,
`categorias`, `user_roles`, `app_settings`, la función `has_role` y todas sus
políticas RLS). Ese esquema existe solo en el servidor.

`npx supabase db pull` exige Docker Desktop (el CLI corre `pg_dump` en un contenedor),
que es desproporcionado solo para volcar un esquema. La alternativa es `pg_dump` directo:

```bash
scoop install postgresql

pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://postgres:[PASSWORD]@db.rgskspvuvzwmvmsccoez.supabase.co:5432/postgres" \
  > supabase/schema_baseline.sql
```

Password en Dashboard → Settings → Database. Si la conexión directa falla por IPv6
(el host `db.<ref>.supabase.co` es IPv6-only en proyectos nuevos), usar el pooler en
modo sesión: `aws-0-us-west-2.pooler.supabase.com:5432`, usuario `postgres.rgskspvuvzwmvmsccoez`.

**El resultado va en `supabase/schema_baseline.sql`, NO en `supabase/migrations/`.**
Es material de referencia — para consultar el esquema real sin adivinar desde los
queries — no una migración ejecutable. Un archivo suelto en `migrations/` sería
marcado como aplicado por `db push` y enmascararía la ausencia del baseline de forma
permanente. Ya pasó una vez: un `db pull` fallido dejó ahí una migración de 0 bytes
que hubo que borrar.

Hasta que exista ese baseline, cualquier migración nueva asume un esquema que no está
versionado. Para cambios aditivos (crear una tabla nueva) eso no molesta; para
alterar tablas existentes, conviene tener el baseline antes.

## Flujo de trabajo

```bash
# 1. Crear una migración vacía
npx supabase migration new descripcion_del_cambio

# 2. Escribir el SQL en el archivo generado

# 3. Aplicarla al proyecto remoto
npx supabase db push

# 4. Regenerar los tipos y commitear ambos juntos
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

El paso 4 no es opcional. `lib/supabase/types.ts` es un artefacto generado: no se
edita a mano, se regenera. Una migración commiteada sin sus tipos regenerados
reintroduce exactamente el problema que este directorio existe para prevenir.

## Verificación

`npx tsc --noEmit` valida el código contra el esquema real, porque los clientes de
`lib/supabase/{client,server}.ts` están tipados con `Database`. Un nombre de columna
inventado ahora es un error de compilación, no un bug de producción silencioso.

Ojo con los `as` / `as unknown as` sobre resultados de queries: anulan esa validación.
Si hay un cast sobre un `.select()`, el compilador deja de verificar esas columnas.

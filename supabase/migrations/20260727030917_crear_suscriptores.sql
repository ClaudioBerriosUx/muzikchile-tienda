-- Suscriptores al boletín por email (popup de la portada).
--
-- Tabla deliberadamente mínima: un email y de dónde vino. Todo lo que no se
-- necesita para mandar un correo NO se guarda — sin IP, sin user agent, sin
-- referrer. El sitio tiene público internacional (GDPR), y el dato que no se
-- recoge es el que no hay que proteger, exportar ni borrar después.
--
-- El UNIQUE sobre email es la pieza central del anti-duplicado: la unicidad se
-- hace cumplir en la base, no en el cliente. Un chequeo previo del tipo
-- "¿existe ya?" sería a la vez inseguro (anon no puede leer la tabla, y no
-- debe: sería un enumerador de suscriptores) y una condición de carrera. El
-- camino correcto es intentar el INSERT y capturar el 23505.

create table public.suscriptores (
  id         uuid primary key default gen_random_uuid(),

  -- citext sería lo ideal para case-insensitive, pero la extensión no está
  -- habilitada en el proyecto. En su lugar el cliente normaliza a minúsculas
  -- antes de insertar: 'Ana@X.cl' y 'ana@x.cl' son el mismo buzón y tienen
  -- que colisionar contra este UNIQUE.
  email      text not null unique,

  -- 'inactivo' = se dio de baja. No se borra la fila: si se borrara, un
  -- re-alta silenciosa volvería a meterla en la lista sin dejar rastro de que
  -- alguna vez pidió salir.
  estado     text not null default 'activo'
               check (estado in ('activo', 'inactivo')),

  -- De dónde salió el alta: 'popup' hoy; mañana 'footer', 'checkout', import.
  origen     text not null default 'popup',

  created_at timestamptz not null default now()
);

comment on table public.suscriptores is
  'Altas al boletin por email. Solo el admin puede leerlas; anon unicamente inserta.';

comment on column public.suscriptores.email is
  'Normalizado a minusculas por el cliente antes del INSERT. UNIQUE.';


-- ── Índices ──────────────────────────────────────────────────────────────────
-- Ninguno sobre email: el UNIQUE ya crea el suyo.
-- El listado del admin ordena por fecha descendente, y esa sí es la consulta
-- que se va a repetir.

create index suscriptores_created_at_idx on public.suscriptores (created_at desc);


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Asimetría deliberada: escribir es público, leer no lo es.
--
-- Cualquiera puede suscribirse (es un formulario público, no hay sesión), pero
-- la lista de emails es dato personal: solo el admin la ve. Se usa
-- has_role(uuid, app_role), que ya existe en el proyecto.

alter table public.suscriptores enable row level security;


-- INSERT ─────────────────────────────────────────────────────────────────────

-- Alta pública. El `with check (true)` es intencional y es lo que hace que el
-- formulario funcione sin sesión.
--
-- Lo que este INSERT igual NO permite, y por eso las columnas tienen default +
-- CHECK: el cliente manda solo `email` y `origen`; `estado` cae en 'activo' por
-- default y el CHECK impide cualquier valor inventado.
--
-- ⚠️ Un INSERT público es, por definición, escribible por bots. Las defensas
-- que faltan están anotadas en components/ui/PopupSuscripcion.tsx:
-- rate limiting por IP, captcha/Turnstile y doble opt-in con token. Ninguna
-- se puede expresar como política RLS — van en un Route Handler cuando el
-- tráfico lo justifique.
create policy suscriptores_insert_publico
  on public.suscriptores
  for insert
  to anon, authenticated
  with check (true);


-- SELECT / UPDATE / DELETE ───────────────────────────────────────────────────
-- Solo admin. Sin política para artista: la lista de suscriptores es de la
-- plataforma, no de nadie en particular.
--
-- Que anon NO pueda leer es lo que evita que la tabla sea un directorio de
-- correos consultable con la anon key, que es pública por diseño.

create policy suscriptores_select_admin
  on public.suscriptores
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy suscriptores_update_admin
  on public.suscriptores
  for update
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy suscriptores_delete_admin
  on public.suscriptores
  for delete
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

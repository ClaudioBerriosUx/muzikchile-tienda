-- Alta de artistas: solo por invitación.
--
-- Dos cambios, ambos de la tanda de seguridad de invitaciones (2026-09-25).


-- ── 1. user_roles.user_id → auth.users(id) ON DELETE CASCADE ─────────────────
-- Sin FK, al borrar un usuario de auth su rol quedaba suelto. Había 2 filas
-- huérfanas (rol 'artista', creadas el 2026-06-02 durante las pruebas de
-- invitar-artista). Se borran por id explícito: si apareciera otro huérfano, el
-- ADD CONSTRAINT falla y la migración entera se aborta — es el seguro de que
-- no se borra nada que no se haya revisado.

delete from public.user_roles
where user_id in (
  '57d1d452-a867-462d-b3f1-4809d33c37b7',
  '9f360f66-5826-4454-a7e2-650bf21a0fab'
);

alter table public.user_roles
  add constraint user_roles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;


-- ── 2. artista_insert_own exige tener ya el rol 'artista' ────────────────────
-- Antes bastaba `auth.uid() = user_id`. Como el registro público de Auth está
-- abierto y el trigger `trg_assign_artista_role` (SECURITY DEFINER) regala el
-- rol 'artista' a quien inserte su fila, cualquiera podía registrarse, insertar
-- su fila en `artistas` y quedar como artista sin invitación.
--
-- Ahora solo crea su fila quien ya tiene el rol, que se obtiene únicamente por
-- invitación (invitar-artista) o por el admin. PanelShell.ensureArtistaRecord
-- sigue funcionando: corre después de que el invitado ya tiene su rol.
--
-- El trigger se deja: para quien ya es artista es un no-op (ON CONFLICT DO
-- NOTHING), y el admin lo sigue usando al asignar user_id a un artista.

drop policy if exists artista_insert_own on public.artistas;

create policy artista_insert_own on public.artistas
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.has_role(auth.uid(), 'artista'::public.app_role)
  );

/**
 * Cambia la contraseña de un usuario de Auth usando la service role.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO (en tu terminal, NO en un chat)
 *
 *   node --env-file=.env.local scripts/reset-password.mjs <email>
 *
 * En Windows, usar PowerShell o cmd. En Git Bash (mintty) Node no recibe una
 * TTY real y el input oculto no funciona: ahí anteponer `winpty`.
 *
 * Necesita en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La contraseña:
 *   - se pide por terminal con input oculto (no se muestra ni con asteriscos),
 *     dos veces para confirmar;
 *   - NUNCA va como argumento (quedaría en el historial de la shell) ni por
 *     variable de entorno;
 *   - no se imprime ni se loguea en ningún punto, tampoco en los errores.
 *
 * Si stdin no es una terminal (p. ej. `echo pass | node ...`), el script se
 * niega a correr: esa vía deja la contraseña en el historial.
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIN_LARGO = 8;

const email = process.argv[2]?.trim().toLowerCase();

if (!URL || !SERVICE_KEY) {
  console.error(
    "Faltan variables de entorno. Corre con:\n" +
    "  node --env-file=.env.local scripts/reset-password.mjs <email>"
  );
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("Uso: node --env-file=.env.local scripts/reset-password.mjs <email>");
  process.exit(1);
}
if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error(
    "stdin no es una terminal interactiva: no se puede pedir la contraseña oculta.\n" +
    "Córrelo directamente en PowerShell/cmd (en Git Bash: anteponer `winpty`)."
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Input ────────────────────────────────────────────────────────────────────

/**
 * Lee una línea en modo raw sin hacer eco. Soporta backspace; Ctrl+C aborta.
 * El valor solo vive en esta closure y en el retorno.
 */
function leerOculto(pregunta) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(pregunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let valor = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {            // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write("\nCancelado.\n");
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(valor);
          return;
        } else if (ch === "\u007f" || ch === "\b") {  // backspace
          valor = valor.slice(0, -1);
        } else if (ch >= " ") {
          valor += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

/** Lee una línea visible (para la confirmación s/N). */
function leerVisible(pregunta) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(pregunta);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.once("data", (d) => {
      stdin.pause();
      resolve(String(d).trim());
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function buscarUsuario(correo) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === correo);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  const usuario = await buscarUsuario(email);
  if (!usuario) {
    console.error(`No existe un usuario con email ${email}.`);
    process.exit(1);
  }

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", usuario.id);
  console.log(`Usuario: ${usuario.email}`);
  console.log(`  id:    ${usuario.id}`);
  console.log(`  roles: ${(roles ?? []).map((r) => r.role).join(", ") || "ninguno"}`);
  console.log(`Proyecto: ${URL}\n`);

  const pass1 = await leerOculto("Contraseña nueva: ");
  if (pass1.length < MIN_LARGO) {
    console.error(`Muy corta: mínimo ${MIN_LARGO} caracteres. No se cambió nada.`);
    process.exit(1);
  }
  const pass2 = await leerOculto("Repítela:         ");
  if (pass1 !== pass2) {
    console.error("No coinciden. No se cambió nada.");
    process.exit(1);
  }

  const ok = await leerVisible(`¿Cambiar la contraseña de ${usuario.email}? (s/N) `);
  if (!/^s(i|í)?$/i.test(ok)) {
    console.log("Cancelado. No se cambió nada.");
    process.exit(0);
  }

  const { error } = await admin.auth.admin.updateUserById(usuario.id, { password: pass1 });
  if (error) {
    // El mensaje de Auth no incluye la contraseña; igual no se agrega contexto.
    console.error(`Error al cambiar la contraseña: ${error.message}`);
    process.exit(1);
  }

  console.log(`✓ Contraseña actualizada para ${usuario.email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});

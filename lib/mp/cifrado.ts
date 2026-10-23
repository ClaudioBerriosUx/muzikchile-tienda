import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de los tokens de Mercado Pago (y de la cookie del OAuth).
 * Solo servidor: la llave MP_TOKENS_KEY nunca llega al navegador.
 *
 * AES-256-GCM: confidencialidad + integridad (un texto alterado no descifra).
 * Formato: "v1.<iv>.<tag>.<cifrado>" en base64url. El prefijo de versión deja
 * rotar la llave más adelante sin adivinar con cuál se cifró cada valor.
 *
 * MP_TOKENS_KEY: 32 bytes aleatorios en base64. Generarla con
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const VERSION = "v1";

function llave(): Buffer {
  const b64 = process.env.MP_TOKENS_KEY;
  if (!b64) throw new Error("Falta la variable de entorno MP_TOKENS_KEY");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("MP_TOKENS_KEY debe ser de 32 bytes en base64");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", llave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(".");
}

/** Lanza si el valor fue alterado o se cifró con otra llave. */
export function descifrar(valor: string): string {
  const [version, iv, tag, cifrado] = valor.split(".");
  if (version !== VERSION || !iv || !tag || !cifrado) throw new Error("Formato de cifrado desconocido");
  const decipher = createDecipheriv("aes-256-gcm", llave(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, "base64url")), decipher.final()]).toString("utf8");
}

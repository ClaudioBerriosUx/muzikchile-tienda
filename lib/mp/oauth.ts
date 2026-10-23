import { createHash, randomBytes } from "node:crypto";

/**
 * OAuth de Mercado Pago (Chile) con PKCE. Solo servidor.
 *
 * Verificado en el sandbox de MP Chile (2026-10-22):
 * - La autorización va en auth.mercadopago.cl (auth.mercadopago.com pide país).
 * - expires_in = 180 días; el refresh_token ROTA en cada renovación: hay que
 *   guardar el nuevo, el viejo deja de servir.
 *
 * Variables: MP_CLIENT_ID, MP_CLIENT_SECRET, NEXT_PUBLIC_URL (para la
 * redirect_uri, que tiene que coincidir con la registrada en la aplicación).
 */

const AUTH_URL  = "https://auth.mercadopago.cl/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const API_URL   = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

/** Cookie httpOnly con el state y el code_verifier de un intento de conexión. */
export const COOKIE_OAUTH = "mp_oauth";

export interface TokenMP {
  access_token: string;
  refresh_token: string;
  public_key?: string;
  user_id: number;
  expires_in: number;
  scope?: string;
  live_mode: boolean;
}

export interface UsuarioMP {
  id: number;
  nickname?: string;
  email?: string;
}

/** Error de MP con su status: 4xx = rechazo definitivo, 5xx/red = reintentable. */
export class ErrorMP extends Error {
  // Campos explícitos (no parameter properties): los scripts de verificación
  // importan este archivo con el strip-types de Node, que no las soporta.
  readonly status: number;
  readonly detalle?: unknown;

  constructor(message: string, status: number, detalle?: unknown) {
    super(message);
    this.status = status;
    this.detalle = detalle;
  }
  get reintentable() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

export function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_URL}/api/mp/oauth/callback`;
}

function clientId(): string {
  const id = process.env.MP_CLIENT_ID;
  if (!id) throw new Error("Falta MP_CLIENT_ID");
  return id;
}

/** El secreto solo se usa servidor a servidor, al pedir tokens. */
function credenciales() {
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientSecret) throw new Error("Falta MP_CLIENT_SECRET");
  return { clientId: clientId(), clientSecret };
}

/** Par PKCE (RFC 7636, S256) y state aleatorio para un intento de conexión. */
export function nuevoIntento() {
  const verifier = randomBytes(48).toString("base64url"); // 64 caracteres
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");
  return { verifier, challenge, state };
}

export function urlAutorizacion(state: string, challenge: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function pedirToken(campos: Record<string, string>): Promise<TokenMP> {
  const { clientId, clientSecret } = credenciales();
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...campos }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ErrorMP(`Sin respuesta de MP: ${err instanceof Error ? err.message : err}`, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token || !data?.refresh_token || !data?.user_id) {
    // El detalle va al log; nunca incluye el client_secret (no lo devuelve MP).
    throw new ErrorMP(`MP rechazó el pedido de token (${res.status})`, res.status, {
      error: data?.error, message: data?.message, status: data?.status,
    });
  }
  return data as TokenMP;
}

export function intercambiarCodigo(code: string, verifier: string): Promise<TokenMP> {
  return pedirToken({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });
}

export function renovarToken(refreshToken: string): Promise<TokenMP> {
  return pedirToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function obtenerUsuario(accessToken: string): Promise<UsuarioMP> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ErrorMP(`Sin respuesta de MP: ${err instanceof Error ? err.message : err}`, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.id !== "number") throw new ErrorMP(`MP no devolvió el usuario (${res.status})`, res.status);
  return { id: data.id, nickname: data.nickname, email: data.email };
}

/**
 * invitar-artista — el admin invita a un artista por email.
 *
 * Solo la puede usar un admin. El control de acceso vive ACÁ, no solo en la
 * plataforma:
 *   - sin Authorization / token inválido → 401
 *   - usuario que no es admin            → 403
 *   - email con formato inválido         → 400
 *
 * El token se valida contra Auth con `auth.getUser(token)`, que funciona con las
 * llaves de firma asimétricas (ES256) del proyecto.
 *
 * ⚠️ `verify_jwt` de la plataforma está en FALSE (heredado del deploy original;
 * el repo no tiene supabase/config.toml, así que `functions deploy` conserva lo
 * que había). La seguridad NO depende de él: esta función hace su propia
 * verificación y `npm run verificar:invitar` lo prueba (caso a → 401).
 *
 * Los logs no incluyen el body ni el email invitado: solo el resultado y el uid
 * del admin.
 *
 * Verificación: `npm run verificar:invitar`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function responder(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const serviceRoleKey =
    Deno.env.get('SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Identidad ──────────────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder(401, { error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const uid = userData?.user?.id
  if (userError || !uid) return responder(401, { error: 'No autenticado' })

  // ── Autorización ───────────────────────────────────────────────────────────
  const { data: esAdmin, error: rolError } = await supabase.rpc('has_role', {
    _user_id: uid,
    _role: 'admin',
  })
  if (rolError) {
    console.error('invitar-artista: error verificando rol:', rolError.message)
    return responder(500, { error: 'No se pudo verificar el rol' })
  }
  if (!esAdmin) return responder(403, { error: 'Solo un admin puede invitar artistas' })

  // ── Invitación ─────────────────────────────────────────────────────────────
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email)) return responder(400, { error: 'Email inválido' })

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://tienda.muzikchile.cl'

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/registro`,
    })
    if (error) throw error

    const { error: rolInsertError } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: data.user.id, role: 'artista' },
        { onConflict: 'user_id,role', ignoreDuplicates: true }
      )
    if (rolInsertError) throw rolInsertError

    console.log('invitar-artista: invitación ok, admin', uid)
    return responder(200, { success: true })
  } catch (error) {
    const mensaje = (error as Error).message
    const status = (error as { status?: number }).status === 429 ? 429 : 400
    console.error('invitar-artista: invitación con error, admin', uid, '-', mensaje)
    return responder(status, { error: mensaje })
  }
})

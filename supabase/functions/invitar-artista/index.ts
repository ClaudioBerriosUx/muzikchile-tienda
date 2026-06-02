import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Body recibido:', JSON.stringify(body))

    const { email } = body

    const serviceRoleKey =
      Deno.env.get('SERVICE_ROLE_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('SERVICE_ROLE_KEY existe:', !!serviceRoleKey)
    console.log('SUPABASE_URL:', Deno.env.get('SUPABASE_URL'))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey!
    )

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://tienda.muzikchile.cl'

    console.log('Invitando a:', email)
    console.log('siteUrl:', siteUrl)

    const { data, error } = await supabase.auth.admin
      .inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/registro`
      })

    console.log('Resultado invite:', JSON.stringify({ data, error }))

    if (error) throw error

    const roleResult = await supabase
      .from('user_roles')
      .insert({ user_id: data.user.id, role: 'artista' })

    console.log('Rol asignado:', JSON.stringify(roleResult))

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('ERROR:', (error as Error).message, JSON.stringify(error))
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

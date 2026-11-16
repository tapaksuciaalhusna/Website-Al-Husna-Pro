import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'super_admin') return new Response(JSON.stringify({ error: 'Hanya administrator utama yang dapat membuat admin.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const fullName = String(body.full_name || '').trim()
    if (!email || password.length < 10 || !fullName) return new Response(JSON.stringify({ error: 'Nama, email, dan kata sandi minimal 10 karakter wajib diisi.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const admin = createClient(url, service)
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { manager_name: fullName } })
    if (error) throw error
    const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, role: 'admin', manager_name: fullName, kontingen_name: 'Administrator' })
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); throw profileError }
    return new Response(JSON.stringify({ message: `Akun administrator untuk ${email} berhasil dibuat.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

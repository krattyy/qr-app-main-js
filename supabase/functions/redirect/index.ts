// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('s')

    // 1. Slug kontrolü
    if (!slug) {
      return new Response("Hata: Link geçersiz (Slug eksik)", { status: 400 })
    }

    // 2. Supabase bağlantısı
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Veritabanından hedef URL'i çek
    const { data, error } = await supabase
      .from('qrcodes')
      .select('target_url')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      return new Response("Hata: QR Kod bulunamadı", { status: 404 })
    }

    // 4. Linki düzelt (Başına https:// ekleme otonomisi)
    let targetUrl = data.target_url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }

    // 5. Sayacı artır (Arka planda çalışır)
    await supabase.rpc('increment_scan_by_slug', { target_slug: slug })

    // 6. Yönlendir
    return Response.redirect(targetUrl, 302)

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
})
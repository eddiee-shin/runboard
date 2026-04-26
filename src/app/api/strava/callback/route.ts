import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/profile?strava=error`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('Strava token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${baseUrl}/profile?strava=error`)
    }

    const tokenData = await tokenRes.json()

    // Upsert tokens into strava_tokens table
    const { error: dbError } = await supabase
      .from('strava_tokens')
      .upsert({
        profile_id: user.id,
        strava_athlete_id: tokenData.athlete?.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    if (dbError) {
      console.error('Failed to save Strava tokens:', dbError)
      return NextResponse.redirect(`${baseUrl}/profile?strava=error`)
    }

    return NextResponse.redirect(`${baseUrl}/profile?strava=connected`)
  } catch (err) {
    console.error('Strava callback error:', err)
    return NextResponse.redirect(`${baseUrl}/profile?strava=error`)
  }
}

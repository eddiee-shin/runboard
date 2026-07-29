import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const origin = new URL(request.url).origin
  const baseUrl = origin

  if (!user) {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = `${baseUrl}/api/strava/callback`

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=force&scope=activity:read_all`

  return NextResponse.redirect(stravaAuthUrl)
}

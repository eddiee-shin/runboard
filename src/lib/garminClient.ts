const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface GarminSyncParams {
  username: string
  password: string
  mfaCode?: string | null
}

interface GarminSyncResult {
  success?: boolean
  mfaRequired?: boolean
  message?: string
  runs?: any[]
  error?: string
}

export async function syncGarminActivities({ username, password, mfaCode }: GarminSyncParams): Promise<GarminSyncResult> {
  try {
    const cookieJar = new Map<string, string>()

    const getCookieHeader = () => {
      return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
    }

    const parseAndStoreCookies = (res: Response) => {
      const headers = res.headers
      const setCookies = headers.getSetCookie ? headers.getSetCookie() : []
      for (const c of setCookies) {
        const parts = c.split(';')[0].split('=')
        if (parts.length >= 2) {
          cookieJar.set(parts[0].trim(), parts.slice(1).join('=').trim())
        }
      }
    }

    // 1. GET Embed Page to get CSRF token and initial cookies
    const embedUrl = 'https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'
    
    const res1 = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })

    parseAndStoreCookies(res1)
    const html1 = await res1.text()
    const csrfMatch = html1.match(/name="_csrf"\s+value="([^"]+)"/) || html1.match(/value="([^"]+)"\s+name="_csrf"/)
    const csrfToken = csrfMatch ? csrfMatch[1] : ''

    if (!csrfToken) {
      return { error: 'Garmin SSO 초기화 실패 (CSRF 토큰을 찾을 수 없습니다).' }
    }

    // 2. Signin POST request
    const signinUrl = 'https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin'

    const params = new URLSearchParams({
      username,
      password,
      _csrf: csrfToken,
      embed: 'true',
      embedWidget: 'true',
    })

    if (mfaCode) {
      params.append('mfaCode', mfaCode)
      params.append('twoFactorCode', mfaCode)
    }

    const res2 = await fetch(signinUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieHeader(),
        'Referer': embedUrl,
        'Origin': 'https://sso.garmin.com',
      },
      body: params.toString(),
    })

    parseAndStoreCookies(res2)
    const html2 = await res2.text()

    // Check if MFA is requested
    if (!mfaCode && (html2.includes('mfaCode') || html2.includes('twoFactor') || html2.includes('sendCode') || html2.includes('verificationCode'))) {
      return {
        mfaRequired: true,
        message: '등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요.'
      }
    }

    // Check for ticket
    const ticketMatch = html2.match(/ticket=([A-Za-z0-9\-]+)/) || (res2.url && res2.url.match(/ticket=([A-Za-z0-9\-]+)/))
    const ticket = ticketMatch ? ticketMatch[1] : null

    if (!ticket) {
      if (html2.includes('Invalid credentials') || html2.includes('login failed') || html2.includes('Unable to sign in')) {
        return { error: 'Garmin 로그인 실패: 이메일 또는 비밀번호가 올바르지 않습니다.' }
      }
      return {
        mfaRequired: true,
        message: 'Garmin 계정 보안을 위해 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 코드를 입력해 주세요.'
      }
    }

    // 3. Exchange ticket for Connect session
    const modernUrl = `https://connect.garmin.com/modern?ticket=${ticket}`
    const res3 = await fetch(modernUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Cookie': getCookieHeader(),
      }
    })
    parseAndStoreCookies(res3)

    // 4. Fetch activities metadata
    const activitiesUrl = 'https://connect.garmin.com/modern/main/service/proxy/activitylist-service/activities/search/metadata?start=0&limit=30'
    const res4 = await fetch(activitiesUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Cookie': getCookieHeader(),
        'NK': 'NT',
      }
    })

    if (!res4.ok) {
      return { error: `Garmin 활동 데이터 조회 실패 (HTTP ${res4.status})` }
    }

    const activities = await res4.json()

    // Filter running activities
    const runs = (activities || []).filter((a: any) => {
      const typeKey = (a.activityType?.typeKey || '').toLowerCase()
      const parentTypeKey = a.activityType?.parentTypeId || 0
      return typeKey.includes('run') || parentTypeKey === 1
    })

    return {
      success: true,
      runs: runs.map((a: any) => ({
        activityId: a.activityId,
        activityName: a.activityName,
        startTimeLocal: a.startTimeLocal || a.startTimeGMT,
        distance: a.distance || 0,
        duration: a.movingDuration || a.duration || 0,
        averageHR: a.averageHR || null,
        maxHR: a.maxHR || null,
        calories: a.calories || 0,
        elevationGain: a.elevationGain || 0,
      }))
    }
  } catch (err: any) {
    console.error('Pure TS Garmin Client Error:', err)
    return { error: `Garmin 동기화 연동 오류: ${err.message || String(err)}` }
  }
}

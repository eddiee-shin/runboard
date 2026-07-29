const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface GarminSyncParams {
  username?: string
  password?: string
  mfaCode?: string | null
  sessionCookies?: string | null
}

interface GarminSyncResult {
  success?: boolean
  mfaRequired?: boolean
  message?: string
  sessionCookies?: string
  runs?: any[]
  error?: string
}

export async function syncGarminActivities({ username, password, mfaCode, sessionCookies }: GarminSyncParams): Promise<GarminSyncResult> {
  try {
    const cookieJar = new Map<string, string>()

    if (sessionCookies) {
      const parts = sessionCookies.split(';')
      for (const p of parts) {
        const kv = p.trim().split('=')
        if (kv.length >= 2) {
          cookieJar.set(kv[0].trim(), kv.slice(1).join('=').trim())
        }
      }
    }

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

    // Helper to fetch with manual redirect tracking so Set-Cookie is never lost across 302 redirects
    const customFetch = async (url: string, options: RequestInit = {}, maxRedirects = 8): Promise<Response> => {
      let currentUrl = url
      let res: Response = new Response()

      for (let i = 0; i < maxRedirects; i++) {
        const reqHeaders: Record<string, string> = {
          'User-Agent': USER_AGENT,
          ...(options.headers as Record<string, string> || {}),
        }

        const cookieStr = getCookieHeader()
        if (cookieStr) {
          reqHeaders['Cookie'] = cookieStr
        }

        res = await fetch(currentUrl, {
          ...options,
          headers: reqHeaders,
          redirect: 'manual',
        })

        parseAndStoreCookies(res)

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location')
          if (!loc) break
          currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString()
          // For 302 redirect after POST, switch to GET
          options = { ...options, method: 'GET', body: undefined }
        } else {
          break
        }
      }
      return res
    }

    // 0. Try fetching activities directly if sessionCookies are present (and no mfaCode)
    if (sessionCookies && !mfaCode) {
      const activitiesUrl = 'https://connect.garmin.com/modern/main/service/proxy/activitylist-service/activities/search/metadata?start=0&limit=30'
      const testRes = await customFetch(activitiesUrl, {
        headers: { 'NK': 'NT' }
      })

      const contentType = testRes.headers.get('content-type') || ''
      if (testRes.ok && contentType.includes('application/json')) {
        const activities = await testRes.json()
        const runs = (activities || []).filter((a: any) => {
          const typeKey = (a.activityType?.typeKey || '').toLowerCase()
          const parentTypeKey = a.activityType?.parentTypeId || 0
          return typeKey.includes('run') || parentTypeKey === 1
        })

        return {
          success: true,
          sessionCookies: getCookieHeader(),
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
      }
    }

    const embedUrl = 'https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'

    let ticket: string | null = null

    if (!mfaCode) {
      // Step 1: GET Embed Page to get CSRF token and initial cookies
      const res1 = await customFetch(embedUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      })

      const html1 = await res1.text()
      const csrfMatch = html1.match(/name="_csrf"\s+value="([^"]+)"/) || html1.match(/value="([^"]+)"\s+name="_csrf"/)
      const csrfToken = csrfMatch ? csrfMatch[1] : ''

      if (!csrfToken) {
        return { error: 'Garmin SSO 초기화 실패 (CSRF 토큰을 찾을 수 없습니다).' }
      }

      // Step 2: Submit Credentials
      const signinUrl = 'https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin'

      const params = new URLSearchParams({
        username: username || '',
        password: password || '',
        _csrf: csrfToken,
        embed: 'true',
        embedWidget: 'true',
      })

      const res2 = await customFetch(signinUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': embedUrl,
          'Origin': 'https://sso.garmin.com',
        },
        body: params.toString(),
      })

      const html2 = await res2.text()

      // Check for ticket
      const ticketMatch = html2.match(/ticket=([A-Za-z0-9\-]+)/) || (res2.url && res2.url.match(/ticket=([A-Za-z0-9\-]+)/))
      ticket = ticketMatch ? ticketMatch[1] : null

      if (!ticket) {
        if (html2.includes('mfaCode') || html2.includes('twoFactor') || html2.includes('sendCode') || html2.includes('verificationCode') || html2.includes('mfa-code') || html2.includes('verifyMFA')) {
          return {
            mfaRequired: true,
            sessionCookies: getCookieHeader(),
            message: '등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요.'
          }
        }

        if (html2.includes('Invalid credentials') || html2.includes('login failed') || html2.includes('Unable to sign in')) {
          return { error: 'Garmin 로그인 실패: 이메일 또는 비밀번호가 올바르지 않습니다.' }
        }

        return {
          mfaRequired: true,
          sessionCookies: getCookieHeader(),
          message: 'Garmin 계정 보안을 위해 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 코드를 입력해 주세요.'
        }
      }

    } else {
      // Step 3: Verify MFA Code using correct Garmin MFA verification endpoints
      const mfaEndpoints = [
        'https://sso.garmin.com/sso/verifyMFA/loginEnterMfaCode?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin',
        'https://sso.garmin.com/sso/verifyMFA?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin',
        'https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin'
      ]

      let lastMfaHtml = ''

      for (const endpoint of mfaEndpoints) {
        const mfaParams = new URLSearchParams({
          'mfa-code': mfaCode,
          'mfaCode': mfaCode,
          'twoFactorCode': mfaCode,
          'embed': 'true',
          'embedWidget': 'true',
          'fromPage': 'mfa',
        })

        const resMfa = await customFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': embedUrl,
            'Origin': 'https://sso.garmin.com',
          },
          body: mfaParams.toString(),
        })

        lastMfaHtml = await resMfa.text()

        const tMatch = lastMfaHtml.match(/ticket=([A-Za-z0-9\-]+)/) || (resMfa.url && resMfa.url.match(/ticket=([A-Za-z0-9\-]+)/))
        if (tMatch) {
          ticket = tMatch[1]
          break
        }
      }

      if (!ticket) {
        return {
          error: `2차 인증 코드 검증 실패: 인증 코드가 올바르지 않거나 만료되었습니다. 다시 시도해 주세요.`
        }
      }
    }

    // Step 4: Exchange ticket for Connect session with full redirect cookie tracking
    const modernUrl = `https://connect.garmin.com/modern?ticket=${ticket}`
    await customFetch(modernUrl)

    // Step 5: Fetch activities metadata
    const activitiesUrl = 'https://connect.garmin.com/modern/main/service/proxy/activitylist-service/activities/search/metadata?start=0&limit=30'
    const res4 = await customFetch(activitiesUrl, {
      headers: { 'NK': 'NT' }
    })

    const contentType4 = res4.headers.get('content-type') || ''
    const bodyText = await res4.text()

    if (!res4.ok || !contentType4.includes('application/json')) {
      console.error('Garmin activities fetch non-JSON response:', bodyText.slice(0, 300))
      return { error: 'Garmin 연동 세션 발급에 실패했습니다. 이메일/비밀번호를 확인하고 다시 시도해 주세요.' }
    }

    let activities: any[] = []
    try {
      activities = JSON.parse(bodyText)
    } catch {
      return { error: 'Garmin 응답 데이터를 파싱할 수 없습니다.' }
    }

    // Filter running activities
    const runs = (activities || []).filter((a: any) => {
      const typeKey = (a.activityType?.typeKey || '').toLowerCase()
      const parentTypeKey = a.activityType?.parentTypeId || 0
      return typeKey.includes('run') || parentTypeKey === 1
    })

    return {
      success: true,
      sessionCookies: getCookieHeader(),
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

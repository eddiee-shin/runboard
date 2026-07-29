const MOBILE_UA = 'Connect/4.75.1 (com.garmin.connect.mobile; build:4.75.1.1; iOS 16.5.0)'

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

    const customFetch = async (url: string, options: RequestInit = {}, maxRedirects = 8): Promise<Response> => {
      let currentUrl = url
      let res: Response = new Response()

      for (let i = 0; i < maxRedirects; i++) {
        const reqHeaders: Record<string, string> = {
          'User-Agent': MOBILE_UA,
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
          options = { ...options, method: 'GET', body: undefined }
        } else {
          break
        }
      }
      return res
    }

    // 0. Try fetching activities directly if sessionCookies are present (and no mfaCode)
    if (sessionCookies && !mfaCode) {
      const jwtWeb = cookieJar.get('JWT_WEB')
      const activitiesUrl = 'https://connect.garmin.com/modern/main/service/proxy/activitylist-service/activities/search/metadata?start=0&limit=30'
      
      const reqHeaders: Record<string, string> = { 'NK': 'NT' }
      if (jwtWeb) {
        reqHeaders['Authorization'] = `Bearer ${jwtWeb}`
      }

      const testRes = await customFetch(activitiesUrl, { headers: reqHeaders })

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

    // Garmin Mobile SSO Credentials Configuration
    const configs = [
      { clientId: 'GCM_IOS_DARK', serviceUrl: 'https://mobile.integration.garmin.com/gcm/ios' },
      { clientId: 'GCM_ANDROID_DARK', serviceUrl: 'https://mobile.integration.garmin.com/gcm/android' },
      { clientId: 'GarminConnect', serviceUrl: 'https://connect.garmin.com/app' },
    ]

    let ticket: string | null = null
    let activeServiceUrl = ''
    let activeClientId = ''
    let lastErrorMsg = ''

    if (!mfaCode) {
      // Step 1: Mobile API Login Try Cascading Configurations
      for (const cfg of configs) {
        const loginUrl = `https://sso.garmin.com/mobile/api/login?clientId=${encodeURIComponent(cfg.clientId)}&locale=en-US&service=${encodeURIComponent(cfg.serviceUrl)}`
        
        const res1 = await customFetch(loginUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://sso.garmin.com',
          },
          body: JSON.stringify({
            username: username || '',
            password: password || '',
            rememberMe: true,
            captchaToken: '',
          })
        })

        const json1 = await res1.json().catch(() => ({}))
        const respType = json1?.responseStatus?.type

        if (respType === 'MFA_REQUIRED') {
          return {
            mfaRequired: true,
            sessionCookies: getCookieHeader(),
            message: '등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요.'
          }
        }

        if (respType === 'INVALID_USERNAME_PASSWORD') {
          return { error: 'Garmin 로그인 실패: 이메일 또는 비밀번호가 올바르지 않습니다.' }
        }

        if (respType === 'SUCCESSFUL' && json1.serviceTicketId) {
          ticket = json1.serviceTicketId
          activeServiceUrl = cfg.serviceUrl
          activeClientId = cfg.clientId
          break
        } else {
          lastErrorMsg = json1?.responseStatus?.message || json1?.message || JSON.stringify(json1)
        }
      }

      if (!ticket) {
        return { error: `Garmin 로그인 실패: ${lastErrorMsg || '알 수 없는 오류'}` }
      }

    } else {
      // Step 2: Mobile MFA Verification Try Cascading Configurations
      for (const cfg of configs) {
        const mfaUrl = `https://sso.garmin.com/mobile/api/mfa/verifyCode?clientId=${encodeURIComponent(cfg.clientId)}&locale=en-US&service=${encodeURIComponent(cfg.serviceUrl)}`

        const resMfa = await customFetch(mfaUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://sso.garmin.com',
          },
          body: JSON.stringify({
            mfaMethod: 'email',
            mfaVerificationCode: mfaCode,
            rememberMyBrowser: true,
            reconsentList: [],
            mfaSetup: false,
          })
        })

        const jsonMfa = await resMfa.json().catch(() => ({}))

        if (jsonMfa?.responseStatus?.type === 'SUCCESSFUL' && jsonMfa.serviceTicketId) {
          ticket = jsonMfa.serviceTicketId
          activeServiceUrl = cfg.serviceUrl
          activeClientId = cfg.clientId
          break
        }
      }

      if (!ticket) {
        return { error: '2차 인증 코드 검증 실패: 인증 코드가 올바르지 않거나 만료되었습니다. 다시 시도해 주세요.' }
      }
    }

    // Step 3: Ticket Exchange for Connect session
    const exchangeUrl = activeServiceUrl.includes('connect.garmin.com')
      ? `${activeServiceUrl}?ticket=${ticket}`
      : `https://connect.garmin.com/modern?ticket=${ticket}`
    
    await customFetch(exchangeUrl)

    const jwtWeb = cookieJar.get('JWT_WEB')

    // Step 4: Fetch activities metadata
    const activitiesUrl = 'https://connect.garmin.com/modern/main/service/proxy/activitylist-service/activities/search/metadata?start=0&limit=30'
    const fetchHeaders: Record<string, string> = { 'NK': 'NT' }
    if (jwtWeb) {
      fetchHeaders['Authorization'] = `Bearer ${jwtWeb}`
    }

    const res4 = await customFetch(activitiesUrl, {
      headers: fetchHeaders
    })

    const contentType4 = res4.headers.get('content-type') || ''
    const bodyText = await res4.text()

    if (!res4.ok || !contentType4.includes('application/json')) {
      console.error('Garmin activities fetch non-JSON response:', bodyText.slice(0, 300))
      return { error: 'Garmin 활동 데이터 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
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

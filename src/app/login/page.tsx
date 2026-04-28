'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [isKakao, setIsKakao] = useState(false)

  useEffect(() => {
    // Detect KakaoTalk in-app browser
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('kakaotalk')) {
      setIsKakao(true)
    }
  }, [])

  const handleGoogleLogin = async () => {
    try {
      const supabase = createClient()
      
      // Debug: check if supabase client is valid
      if (!supabase?.auth) {
        setDebugInfo('Error: Supabase client failed to initialize. Check env vars.')
        return
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setDebugInfo(`OAuth Error: ${error.message}`)
      }
    } catch (err: any) {
      setDebugInfo(`Exception: ${err.message}`)
    }
  }

  const handleOpenExternalBrowser = () => {
    const currentUrl = window.location.href
    // Try to open external browser via Kakao scheme
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 className="header-title" style={{ fontSize: '3rem', marginBottom: '10px' }}>RUNBOARD</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.1rem' }}>
        Track your progress.<br />
        Compete with your crew.
      </p>

      {isKakao ? (
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '320px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1.1rem' }}>
            카카오톡 브라우저 제한
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
            구글 보안 정책으로 인해 카카오톡 내부 브라우저에서는 로그인이 불가능합니다.<br/><br/>
            아래 버튼을 눌러 <strong>기본 브라우저(Safari/Chrome)</strong>에서 열어주세요.
          </p>
          <button
            onClick={handleOpenExternalBrowser}
            style={{
              background: 'var(--volt)',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'var(--font-inter)'
            }}
          >
            기본 브라우저로 열기
          </button>
        </div>
      ) : (
        <button 
          onClick={handleGoogleLogin}
          style={{
            background: 'var(--text-primary)',
            color: 'var(--bg-color)',
            border: 'none',
            borderRadius: '30px',
            padding: '16px 32px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'transform 0.2s',
            fontFamily: 'var(--font-inter)'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      )}

      {debugInfo && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px 20px', 
          background: 'rgba(255,68,68,0.1)', 
          border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: '8px',
          color: '#ff6666', 
          fontSize: '0.85rem',
          maxWidth: '400px',
          wordBreak: 'break-all'
        }}>
          {debugInfo}
        </div>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '30px', opacity: 0.7 }}>
        By continuing, you agree to our Terms of Service <br />and Privacy Policy.
      </p>
    </div>
  )
}

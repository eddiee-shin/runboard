'use client'

import { useState, useEffect } from 'react'
import { Share, Download, X } from 'lucide-react'

export default function InstallPWA() {
  const [showPopup, setShowPopup] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true)
      return
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Android: Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    })
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowPopup(true)
    } else if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      // General guide for other browsers
      setShowPopup(true)
    }
  }

  if (isStandalone) return null

  return (
    <>
      <button 
        onClick={handleInstallClick}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #CEFF00 0%, #a8cf00 100%)',
          color: '#000',
          padding: '16px',
          borderRadius: '16px',
          fontWeight: 800,
          fontSize: '1rem',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          cursor: 'pointer',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(206, 255, 0, 0.2)'
        }}
      >
        <Download size={20} /> 바탕화면에 앱 설치하기
      </button>

      {showPopup && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#1A1A1A',
            borderRadius: '24px',
            padding: '30px 20px',
            width: '100%',
            maxWidth: '350px',
            position: 'relative',
            textAlign: 'center',
            color: '#FFF',
            border: '1px solid #333'
          }}>
            <button 
              onClick={() => setShowPopup(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#666' }}
            >
              <X size={24} />
            </button>

            <div style={{ width: '60px', height: '60px', background: '#000', borderRadius: '15px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CEFF00' }}>
              <img src="/apple-touch-icon.png" alt="App Icon" style={{ width: '100%', borderRadius: '15px' }} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '10px' }}>바탕화면에 추가</h3>
            
            {isIOS ? (
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#BBB' }}>
                아이폰 사용자께서는 Safari 브라우저 하단의 
                <div style={{ margin: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#CEFF00', fontWeight: 700 }}>
                  <Share size={20} color="#007AFF" /> <b>공유 버튼</b>을 누른 뒤
                </div>
                스크롤을 내려 <br/><b>[홈 화면에 추가]</b>를 선택해주세요.
              </div>
            ) : (
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#BBB' }}>
                브라우저 우측 상단의 메뉴 버튼을 누르고 <br/><b>[앱 설치]</b> 또는 <b>[홈 화면에 추가]</b>를 선택해주세요.
              </div>
            )}

            <button 
              onClick={() => setShowPopup(false)}
              style={{
                marginTop: '30px',
                width: '100%',
                background: '#333',
                color: '#FFF',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 700
              }}
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
    </>
  )
}

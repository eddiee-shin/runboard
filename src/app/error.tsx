'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="content" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <h2 className="header-title">SOMETHING WENT WRONG</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        An unexpected error occurred.
      </p>
      <button onClick={() => reset()} className="action-btn">
        TRY AGAIN
      </button>
    </div>
  )
}

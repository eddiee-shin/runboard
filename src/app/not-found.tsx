'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="content" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <h2 className="header-title">404 - PAGE NOT FOUND</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        The page you are looking for doesn't exist.
      </p>
      <Link href="/leaderboard" className="action-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
        GO TO LEADERBOARD
      </Link>
    </div>
  )
}

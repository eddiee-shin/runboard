'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <div className="tab-nav">
      <Link 
        href="/upload" 
        className={`tab-btn ${pathname === '/upload' ? 'active' : ''}`}
      >
        Upload
      </Link>
      <Link 
        href="/leaderboard" 
        className={`tab-btn ${pathname === '/leaderboard' ? 'active' : ''}`}
      >
        Leaderboard
      </Link>
      <Link 
        href="/stats" 
        className={`tab-btn ${pathname === '/stats' ? 'active' : ''}`}
      >
        Stats
      </Link>
    </div>
  );
}

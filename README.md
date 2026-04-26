# RunBoard

러닝 앱 스크린샷 업로드 → AI 추출 → 목표 대비 피드백 → 크루 리더보드/통계 앱

## Tech Stack
- Next.js 15
- Supabase
- Google OAuth
- Vercel

## Structure
- `src/app` — routes and pages
- `src/components` — UI components
- `src/lib` — utilities and clients
- `src/hooks` — React hooks
- `src/types` — shared TypeScript types
- `supabase/migrations` — SQL migrations
- `supabase/seed` — seed data
- `public/images` — static assets
- `docs` — product and schema docs

## Next Steps
1. Initialize Next.js app
2. Add Supabase auth and storage
3. Implement upload + extraction flow
4. Build goals, leaderboard, stats pages

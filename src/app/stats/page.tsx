import { redirect } from 'next/navigation'

export default function StatsRedirect({ searchParams }: { searchParams?: { filter?: string } }) {
  const filter = searchParams?.filter
  redirect(filter ? `/runs?filter=${encodeURIComponent(filter)}` : '/runs')
}

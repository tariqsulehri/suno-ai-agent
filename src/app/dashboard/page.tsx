import { DashboardClient } from './dashboard-client'
import { getDashboardData } from '@/lib/db/dashboard-query'
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session = await verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value)
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    redirect('/dashboard/login')
  }

  const sessionMeta = { role: session.role, shopId: session.shopId }

  try {
    const data = await getDashboardData({
      shopId: session.role === 'manager' ? session.shopId : null,
    })
    return <DashboardClient data={data} session={sessionMeta} />
  } catch (err) {
    console.error('[dashboard page]', err)
    return <DashboardClient data={null} session={sessionMeta} />
  }
}

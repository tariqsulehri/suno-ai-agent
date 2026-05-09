import { DashboardClient } from './dashboard-client'
import { getDashboardData } from '@/lib/db/dashboard-query'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  try {
    const data = await getDashboardData()
    return <DashboardClient data={data} />
  } catch (err) {
    console.error('[dashboard page]', err)
    return <DashboardClient data={null} />
  }
}

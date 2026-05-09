import { db } from './client'
import tenants from '@/data/tenants.json'

/**
 * Ensures every tenant that uses agentType reviews/complaints has a Shop row.
 * Safe to call on every server boot — uses upsert.
 */
export async function seedShops() {
  const reviewTenants = (tenants as Array<Record<string, unknown>>).filter(
    (t) => t.agentType === 'reviews' || t.agentType === 'complaints'
  )

  for (const t of reviewTenants) {
    await db.shop.upsert({
      where:  { tenantId: t.id as string },
      update: { name: t.companyName as string },
      create: {
        tenantId: t.id as string,
        name:     t.companyName as string,
      },
    })
  }
}

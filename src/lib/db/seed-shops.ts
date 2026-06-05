import { connectDB, Shop } from './client'
import tenants from '@/data/tenants.json'

/**
 * Ensures every tenant that uses agentType reviews/complaints has a Shop document.
 * Safe to call on every server boot — uses findOneAndUpdate with upsert.
 */
export async function seedShops() {
  await connectDB()
  const reviewTenants = (tenants as Array<Record<string, unknown>>).filter(
    (t) => t.agentType === 'reviews' || t.agentType === 'complaints'
  )

  for (const t of reviewTenants) {
    await Shop.findOneAndUpdate(
      { tenantId: t.id as string },
      { $setOnInsert: { _id: crypto.randomUUID(), tenantId: t.id as string, name: t.companyName as string } },
      { upsert: true, new: true },
    )
  }
}

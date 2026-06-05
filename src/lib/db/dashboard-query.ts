import { connectDB } from './connection'
import { Shop, Review, Lead } from './models'

export interface DashboardScope {
  shopId?: string | null
}

function scopeMatch(scope: DashboardScope): Record<string, unknown> {
  return scope.shopId ? { shopId: scope.shopId } : {}
}

async function getTrend(scope: DashboardScope): Promise<{ month: string; count: number }[]> {
  await connectDB()
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const rows = await Review.aggregate([
    { $match: { ...scopeMatch(scope), createdAt: { $gte: twelveMonthsAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  return rows.map((r) => ({ month: r._id as string, count: r.count as number }))
}

async function getRatingDistribution(scope: DashboardScope): Promise<{ rating: number; count: number }[]> {
  await connectDB()
  const rows = await Review.aggregate([
    { $match: { ...scopeMatch(scope), rating: { $ne: null } } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ])
  return rows.map((r) => ({ rating: r._id as number, count: r.count as number }))
}

async function getTopIssues(scope: DashboardScope): Promise<{ subcategory: string; category: string; sentiment: string; count: number }[]> {
  await connectDB()
  const rows = await Review.aggregate([
    {
      $match: {
        ...scopeMatch(scope),
        subcategory: { $ne: null },
        sentiment: { $in: ['negative', 'complaint'] },
      },
    },
    { $group: { _id: { subcategory: '$subcategory', category: '$category', sentiment: '$sentiment' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ])
  return rows.map((r) => ({
    subcategory: r._id.subcategory as string,
    category:    r._id.category   as string,
    sentiment:   r._id.sentiment  as string,
    count:       r.count          as number,
  }))
}

async function getTopSuggestions(scope: DashboardScope): Promise<{ subcategory: string; category: string; count: number }[]> {
  await connectDB()
  const rows = await Review.aggregate([
    { $match: { ...scopeMatch(scope), subcategory: { $ne: null }, sentiment: 'suggestion' } },
    { $group: { _id: { subcategory: '$subcategory', category: '$category' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ])
  return rows.map((r) => ({
    subcategory: r._id.subcategory as string,
    category:    r._id.category   as string,
    count:       r.count          as number,
  }))
}

async function getRecentReviews(scope: DashboardScope) {
  await connectDB()
  const reviews = await Review.find(scopeMatch(scope))
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  const shopIds  = [...new Set(reviews.map((r) => r.shopId))]
  const reviewIds = reviews.map((r) => String(r._id))

  const [shops, leads] = await Promise.all([
    Shop.find({ _id: { $in: shopIds } }).lean(),
    Lead.find({ reviewId: { $in: reviewIds } }).lean(),
  ])

  const shopMap = Object.fromEntries(shops.map((s) => [String(s._id), s.name]))
  const leadMap = Object.fromEntries(leads.map((l) => [l.reviewId, l]))

  return reviews.map((r) => {
    const id   = String(r._id)
    const lead = leadMap[id]
    return {
      id,
      shopName:      shopMap[r.shopId] ?? '',
      sentiment:     r.sentiment     ?? null,
      category:      r.category      ?? null,
      subcategory:   r.subcategory   ?? null,
      rating:        r.rating        ?? null,
      summary:       r.summary       ?? null,
      keyPoints:     r.keyPoints     ?? null,
      transcript:    r.transcript    ?? null,
      status:        r.status,
      ticketId:      r.ticketId      ?? null,
      ticketType:    r.ticketType    ?? null,
      ticketPriority: r.ticketPriority ?? null,
      slaDueAt:      r.slaDueAt ? r.slaDueAt.toISOString() : null,
      leadId:        lead ? String(lead._id) : null,
      leadName:      lead?.name  ?? null,
      leadPhone:     lead?.phone ?? null,
      leadEmail:     lead?.email ?? null,
      createdAt:     r.createdAt.toISOString(),
    }
  })
}

export async function getDashboardData(scope: DashboardScope = {}) {
  await connectDB()
  const match = scopeMatch(scope)

  const [
    sentimentAgg,
    categoryAgg,
    avgRatingAgg,
    totalReviews,
    shops,
    recentTrend,
    ratingDist,
    topIssues,
    topSuggestions,
    recentReviews,
  ] = await Promise.all([
    Review.aggregate([{ $match: match }, { $group: { _id: '$sentiment', count: { $sum: 1 } } }]),
    Review.aggregate([{ $match: match }, { $group: { _id: '$category',  count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Review.aggregate([{ $match: { ...match, rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
    Review.countDocuments(match),
    Shop.find(scope.shopId ? { _id: scope.shopId } : {}).lean(),
    getTrend(scope),
    getRatingDistribution(scope),
    getTopIssues(scope),
    getTopSuggestions(scope),
    getRecentReviews(scope),
  ])

  // ── Sentiment + category maps ───────────────────────────────────────────────
  const bysentiment: Record<string, number> = {}
  for (const row of sentimentAgg) {
    if (row._id) bysentiment[row._id as string] = row.count as number
  }

  const bycategory: Record<string, number> = {}
  for (const row of categoryAgg) {
    if (row._id) bycategory[row._id as string] = row.count as number
  }

  const avgRating = avgRatingAgg[0]?.avg
    ? parseFloat((avgRatingAgg[0].avg as number).toFixed(2))
    : null

  // ── Per-shop stats ──────────────────────────────────────────────────────────
  const shopIds = shops.map((s) => String(s._id))
  const allShopReviews = await Review.find(
    shopIds.length ? { shopId: { $in: shopIds } } : {},
  ).select('shopId sentiment category subcategory rating').lean()

  const shopStats = shops.map((shop) => {
    const id      = String(shop._id)
    const reviews = allShopReviews.filter((r) => r.shopId === id)
    const total      = reviews.length
    const positive   = reviews.filter((r) => r.sentiment === 'positive').length
    const negative   = reviews.filter((r) => r.sentiment === 'negative').length
    const complaint  = reviews.filter((r) => r.sentiment === 'complaint').length
    const suggestion = reviews.filter((r) => r.sentiment === 'suggestion').length
    const ratings    = reviews.map((r) => r.rating).filter((r): r is number => r != null)
    const sum        = ratings.reduce((a, b) => a + b, 0)

    const categoryBreakdown: Record<string, {
      total: number; positive: number; negative: number; complaint: number; suggestion: number
    }> = {}
    for (const r of reviews) {
      if (!r.category) continue
      if (!categoryBreakdown[r.category])
        categoryBreakdown[r.category] = { total: 0, positive: 0, negative: 0, complaint: 0, suggestion: 0 }
      categoryBreakdown[r.category].total++
      if (r.sentiment === 'positive')   categoryBreakdown[r.category].positive++
      if (r.sentiment === 'negative')   categoryBreakdown[r.category].negative++
      if (r.sentiment === 'complaint')  categoryBreakdown[r.category].complaint++
      if (r.sentiment === 'suggestion') categoryBreakdown[r.category].suggestion++
    }

    return {
      id,
      tenantId:     shop.tenantId,
      name:         shop.name,
      city:         shop.city,
      total,
      positive,
      negative,
      complaint,
      suggestion,
      avgRating:    ratings.length ? parseFloat((sum / ratings.length).toFixed(2)) : null,
      categoryBreakdown,
      satisfaction: ratings.length ? Math.round((sum / ratings.length / 5) * 100) : null,
    }
  })

  // ── Global category sentiment split ────────────────────────────────────────
  const categorySentiment: Record<string, {
    positive: number; negative: number; complaint: number; suggestion: number; total: number
  }> = {}
  for (const r of allShopReviews) {
    if (!r.category) continue
    if (!categorySentiment[r.category])
      categorySentiment[r.category] = { positive: 0, negative: 0, complaint: 0, suggestion: 0, total: 0 }
    categorySentiment[r.category].total++
    if (r.sentiment === 'positive')   categorySentiment[r.category].positive++
    if (r.sentiment === 'negative')   categorySentiment[r.category].negative++
    if (r.sentiment === 'complaint')  categorySentiment[r.category].complaint++
    if (r.sentiment === 'suggestion') categorySentiment[r.category].suggestion++
  }

  return {
    totalReviews,
    avgRating,
    bysentiment,
    bycategory,
    categorySentiment,
    trend:        recentTrend,
    ratingDist,
    topIssues,
    topSuggestions,
    recentReviews,
    shops:        shopStats,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

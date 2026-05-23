import { db } from './client'
import Database from 'better-sqlite3'
import { resolveSqliteDbPath } from './path'

type ReviewRow = {
  sentiment:   string | null
  category:    string | null
  subcategory: string | null
  rating:      number | null
}

export interface DashboardScope {
  shopId?: string | null
}

function rawDb() {
  return new Database(resolveSqliteDbPath(), { readonly: true })
}

function scopedWhere(scope: DashboardScope) {
  return scope.shopId ? { shopId: scope.shopId } : undefined
}

function runScopedQuery<T>(sql: string, scope: DashboardScope) {
  const raw = rawDb()
  try {
    return scope.shopId
      ? raw.prepare(sql).all(scope.shopId) as T[]
      : raw.prepare(sql).all() as T[]
  } finally { raw.close() }
}

function getTrend(scope: DashboardScope): { month: string; count: number }[] {
  const shopFilter = scope.shopId ? 'AND shopId = ?' : ''
  return runScopedQuery<{ month: string; count: number }>(`
    SELECT strftime('%Y-%m', createdAt) AS month, COUNT(*) AS count
    FROM Review
    WHERE createdAt >= datetime('now', '-12 months')
      ${shopFilter}
    GROUP BY month ORDER BY month ASC
  `, scope)
}

function getRatingDistribution(scope: DashboardScope): { rating: number; count: number }[] {
  const shopFilter = scope.shopId ? 'AND shopId = ?' : ''
  return runScopedQuery<{ rating: number; count: number }>(`
    SELECT rating, COUNT(*) AS count
    FROM Review
    WHERE rating IS NOT NULL
      ${shopFilter}
    GROUP BY rating ORDER BY rating DESC
  `, scope)
}

function getTopIssues(scope: DashboardScope): { subcategory: string; category: string; sentiment: string; count: number }[] {
  const shopFilter = scope.shopId ? 'AND shopId = ?' : ''
  return runScopedQuery<{ subcategory: string; category: string; sentiment: string; count: number }>(`
    SELECT subcategory, category, sentiment, COUNT(*) AS count
    FROM Review
    WHERE subcategory IS NOT NULL
      AND sentiment IN ('negative','complaint')
      ${shopFilter}
    GROUP BY subcategory, category, sentiment
    ORDER BY count DESC
    LIMIT 8
  `, scope)
}

function getTopSuggestions(scope: DashboardScope): { subcategory: string; category: string; count: number }[] {
  const shopFilter = scope.shopId ? 'AND shopId = ?' : ''
  return runScopedQuery<{ subcategory: string; category: string; count: number }>(`
    SELECT subcategory, category, COUNT(*) AS count
    FROM Review
    WHERE subcategory IS NOT NULL
      AND sentiment = 'suggestion'
      ${shopFilter}
    GROUP BY subcategory, category
    ORDER BY count DESC
    LIMIT 6
  `, scope)
}

function getRecentReviews(scope: DashboardScope): {
  id: string; shopName: string; sentiment: string | null; category: string | null
  subcategory: string | null; rating: number | null; summary: string | null
  keyPoints: string | null; transcript: string | null; status: string
  ticketId: string | null; ticketType: string | null; ticketPriority: string | null; slaDueAt: string | null
  leadId: string | null; leadName: string | null; leadPhone: string | null; leadEmail: string | null
  createdAt: string
}[] {
  const shopFilter = scope.shopId ? 'WHERE r.shopId = ?' : ''
  return runScopedQuery<{
    id: string; shopName: string; sentiment: string | null; category: string | null
    subcategory: string | null; rating: number | null; summary: string | null
    keyPoints: string | null; transcript: string | null; status: string
    ticketId: string | null; ticketType: string | null; ticketPriority: string | null; slaDueAt: string | null
    leadId: string | null; leadName: string | null; leadPhone: string | null; leadEmail: string | null
    createdAt: string
  }>(`
    SELECT r.id, s.name AS shopName, r.sentiment, r.category,
           r.subcategory, r.rating, r.summary, r.keyPoints, r.transcript,
           r.status, r.ticketId, r.ticketType, r.ticketPriority, r.slaDueAt, r.createdAt,
           l.id AS leadId, l.name AS leadName, l.phone AS leadPhone, l.email AS leadEmail
    FROM Review r
    JOIN Shop s ON r.shopId = s.id
    LEFT JOIN Lead l ON l.reviewId = r.id
    ${shopFilter}
    ORDER BY r.createdAt DESC
    LIMIT 200
  `, scope)
}

export async function getDashboardData(scope: DashboardScope = {}) {
  const reviewWhere = scopedWhere(scope)
  const shopWhere = scope.shopId ? { id: scope.shopId } : undefined

  const [bysentimentRaw, bycategoryRaw, avgRatingRaw, shops, allReviews] = await Promise.all([
    db.review.groupBy({ by: ['sentiment'], where: reviewWhere, _count: { sentiment: true } }),
    db.review.groupBy({
      by: ['category'],
      where: reviewWhere,
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    }),
    db.review.aggregate({ where: reviewWhere, _avg: { rating: true } }),
    db.shop.findMany({
      where: shopWhere,
      include: {
        reviews: { select: { sentiment: true, category: true, subcategory: true, rating: true } },
      },
    }),
    db.review.count({ where: reviewWhere }),
  ])

  const recentTrend    = getTrend(scope)
  const ratingDist     = getRatingDistribution(scope)
  const topIssues      = getTopIssues(scope)
  const topSuggestions = getTopSuggestions(scope)
  const recentReviews  = getRecentReviews(scope)

  // ── Per-shop stats ──────────────────────────────────────────────────────────
  const shopStats = shops.map((shop) => {
    const reviews    = shop.reviews as ReviewRow[]
    const total      = reviews.length
    const positive   = reviews.filter((r) => r.sentiment === 'positive').length
    const negative   = reviews.filter((r) => r.sentiment === 'negative').length
    const complaint  = reviews.filter((r) => r.sentiment === 'complaint').length
    const suggestion = reviews.filter((r) => r.sentiment === 'suggestion').length
    const ratings    = reviews.map((r) => r.rating).filter((r): r is number => r !== null)
    const sum        = ratings.reduce((a: number, b: number) => a + b, 0)

    // Category breakdown with full sentiment split
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
      id:          shop.id,
      tenantId:    shop.tenantId,
      name:        shop.name,
      city:        shop.city,
      total,
      positive,
      negative,
      complaint,
      suggestion,
      avgRating:   ratings.length ? parseFloat((sum / ratings.length).toFixed(2)) : null,
      categoryBreakdown,
      satisfaction: ratings.length ? Math.round((sum / ratings.length / 5) * 100) : null,
    }
  })

  // ── Global sentiment + category maps ───────────────────────────────────────
  const bysentiment: Record<string, number> = {}
  for (const row of bysentimentRaw) {
    if (row.sentiment) bysentiment[row.sentiment] = row._count.sentiment
  }

  const bycategory: Record<string, number> = {}
  for (const row of bycategoryRaw) {
    if (row.category) bycategory[row.category] = row._count.category
  }

  // ── Category sentiment split (global) ──────────────────────────────────────
  const allReviewRows = shops.flatMap((s) => s.reviews) as ReviewRow[]
  const categorySentiment: Record<string, {
    positive: number; negative: number; complaint: number; suggestion: number; total: number
  }> = {}
  for (const r of allReviewRows) {
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
    totalReviews: allReviews,
    avgRating:    avgRatingRaw._avg.rating ? parseFloat(avgRatingRaw._avg.rating.toFixed(2)) : null,
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

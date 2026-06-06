import { connectDB } from './connection'
import { Shop, Review } from './models'

// ── Filter types ───────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string    // ISO date string
  dateTo?: string      // ISO date string
  shopIds?: string[]   // empty = all (admin); forced to [shopId] for manager
  provinces?: string[] // Shop.state values; empty = all
  cities?: string[]    // Shop.city values; empty = all
  categories?: string[]
  sentiments?: string[]
}

// ── Response types ─────────────────────────────────────────────────────────────

export interface ShopReportRow {
  id: string
  name: string
  city: string | null
  province: string | null
  total: number
  positive: number
  negative: number
  complaint: number
  suggestion: number
  avgRating: number | null
  satisfaction: number | null
  pendingFollowUps: number
  categoryBreakdown: Record<string, {
    total: number; positive: number; negative: number; complaint: number; suggestion: number
  }>
}

export interface TrendSeries {
  shopId: string
  shopName: string
  data: Array<{ period: string; count: number; satisfaction: number | null }>
}

export interface HeatmapCell {
  shopId: string
  shopName: string
  category: string
  count: number
  topSubcategories: Array<{ subcategory: string; count: number }>
  samples: Array<{ summary: string | null; createdAt: string; sentiment: string | null }>
}

export interface RegionalNode {
  name: string
  type: 'province' | 'city' | 'shop'
  total: number
  positive: number
  negative: number
  complaint: number
  suggestion: number
  avgRating: number | null
  satisfaction: number | null
  children?: RegionalNode[]
  shopId?: string
}

export interface ShopReport {
  shops: ShopReportRow[]
  trend: TrendSeries[]
  heatmap: HeatmapCell[]
  regional: RegionalNode[]
  meta: {
    dateFrom: string | null
    dateTo: string | null
    totalReviews: number
    shopCount: number
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDateMatch(dateFrom?: string, dateTo?: string): Record<string, unknown> | null {
  if (!dateFrom && !dateTo) return null
  const range: Record<string, Date> = {}
  if (dateFrom) range.$gte = new Date(dateFrom)
  if (dateTo) {
    const d = new Date(dateTo)
    d.setHours(23, 59, 59, 999)
    range.$lte = d
  }
  return { createdAt: range }
}

function safeAvg(ratings: number[]): number | null {
  if (!ratings.length) return null
  return parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
}

function safeSatisfaction(avgRating: number | null): number | null {
  return avgRating !== null ? Math.round((avgRating / 5) * 100) : null
}

// ── Shop rows ─────────────────────────────────────────────────────────────────

async function buildShopRows(
  shops: Array<{ _id: string; name: string; city?: string; state?: string }>,
  reviewMatch: Record<string, unknown>,
  pendingMap: Record<string, number>,
): Promise<ShopReportRow[]> {
  if (!shops.length) return []

  const shopIds = shops.map((s) => String(s._id))
  const reviews = await Review.find({ ...reviewMatch, shopId: { $in: shopIds } })
    .select('shopId sentiment category rating')
    .lean()

  const shopMap = Object.fromEntries(shops.map((s) => [String(s._id), s]))

  return shops.map((shop) => {
    const id = String(shop._id)
    const shopReviews = reviews.filter((r) => r.shopId === id)
    const total      = shopReviews.length
    const positive   = shopReviews.filter((r) => r.sentiment === 'positive').length
    const negative   = shopReviews.filter((r) => r.sentiment === 'negative').length
    const complaint  = shopReviews.filter((r) => r.sentiment === 'complaint').length
    const suggestion = shopReviews.filter((r) => r.sentiment === 'suggestion').length
    const ratings    = shopReviews.map((r) => r.rating).filter((r): r is number => r != null)
    const avgRating  = safeAvg(ratings)

    const categoryBreakdown: ShopReportRow['categoryBreakdown'] = {}
    for (const r of shopReviews) {
      if (!r.category) continue
      if (!categoryBreakdown[r.category])
        categoryBreakdown[r.category] = { total: 0, positive: 0, negative: 0, complaint: 0, suggestion: 0 }
      categoryBreakdown[r.category].total++
      if (r.sentiment === 'positive')   categoryBreakdown[r.category].positive++
      if (r.sentiment === 'negative')   categoryBreakdown[r.category].negative++
      if (r.sentiment === 'complaint')  categoryBreakdown[r.category].complaint++
      if (r.sentiment === 'suggestion') categoryBreakdown[r.category].suggestion++
    }

    void shopMap  // suppress unused warning (used above for name/city resolution)
    return {
      id,
      name:             shop.name,
      city:             shop.city ?? null,
      province:         shop.state ?? null,
      total,
      positive,
      negative,
      complaint,
      suggestion,
      avgRating,
      satisfaction:     safeSatisfaction(avgRating),
      pendingFollowUps: pendingMap[id] ?? 0,
      categoryBreakdown,
    }
  })
}

// ── Pending follow-ups ────────────────────────────────────────────────────────

async function getPendingFollowUps(
  shopIds: string[],
  dateMatch: Record<string, unknown> | null,
): Promise<Record<string, number>> {
  if (!shopIds.length) return {}
  const match: Record<string, unknown> = {
    shopId:    { $in: shopIds },
    status:    'pending',
    sentiment: { $ne: 'positive' },
  }
  if (dateMatch) Object.assign(match, dateMatch)

  const rows = await Review.aggregate([
    { $match: match },
    { $group: { _id: '$shopId', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((r) => [r._id as string, r.count as number]))
}

// ── Trend series ──────────────────────────────────────────────────────────────

async function buildTrendSeries(
  shops: Array<{ _id: string; name: string }>,
  reviewMatch: Record<string, unknown>,
  dateFrom?: string,
  dateTo?: string,
): Promise<TrendSeries[]> {
  if (!shops.length) return []

  const rangeMs = dateFrom && dateTo
    ? new Date(dateTo).getTime() - new Date(dateFrom).getTime()
    : 365 * 24 * 60 * 60 * 1000
  const useWeeks = rangeMs <= 60 * 24 * 60 * 60 * 1000

  const periodFormat = useWeeks ? '%Y-W%V' : '%Y-%m'

  const rows = await Review.aggregate([
    { $match: reviewMatch },
    {
      $group: {
        _id: {
          shopId: '$shopId',
          period: { $dateToString: { format: periodFormat, date: '$createdAt' } },
        },
        count:     { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    { $sort: { '_id.period': 1 } },
  ])

  const shopNameMap = Object.fromEntries(shops.map((s) => [String(s._id), s.name]))
  const shopIds     = shops.map((s) => String(s._id))

  // Collect all periods across shops
  const allPeriods = [...new Set(rows.map((r) => r._id.period as string))].sort()

  return shopIds.map((shopId) => {
    const shopRows = rows.filter((r) => r._id.shopId === shopId)
    const byPeriod = Object.fromEntries(shopRows.map((r) => [r._id.period as string, r]))

    return {
      shopId,
      shopName: shopNameMap[shopId] ?? shopId,
      data: allPeriods.map((period) => {
        const row = byPeriod[period]
        const avg = row?.avgRating ? parseFloat((row.avgRating as number).toFixed(2)) : null
        return {
          period,
          count: (row?.count as number) ?? 0,
          satisfaction: safeSatisfaction(avg),
        }
      }),
    }
  })
}

// ── Heat map ──────────────────────────────────────────────────────────────────

async function buildHeatmap(
  shops: Array<{ _id: string; name: string }>,
  reviewMatch: Record<string, unknown>,
): Promise<HeatmapCell[]> {
  if (!shops.length) return []

  const shopIds    = shops.map((s) => String(s._id))
  const shopNameMap = Object.fromEntries(shops.map((s) => [String(s._id), s.name]))

  const rows = await Review.aggregate([
    {
      $match: {
        ...reviewMatch,
        shopId:    { $in: shopIds },
        category:  { $ne: null },
        sentiment: { $in: ['complaint', 'negative'] },
      },
    },
    {
      $group: {
        _id: { shopId: '$shopId', category: '$category' },
        count:       { $sum: 1 },
        subcats:     { $push: '$subcategory' },
        summaryDocs: {
          $push: {
            summary:   '$summary',
            createdAt: '$createdAt',
            sentiment: '$sentiment',
          },
        },
      },
    },
    { $sort: { count: -1 } },
  ])

  return rows.map((row) => {
    const shopId   = row._id.shopId as string
    const category = row._id.category as string

    // Top subcategories
    const subcatCounts: Record<string, number> = {}
    for (const s of (row.subcats as (string | null)[])) {
      if (s) subcatCounts[s] = (subcatCounts[s] ?? 0) + 1
    }
    const topSubcategories = Object.entries(subcatCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([subcategory, count]) => ({ subcategory, count }))

    // 3 sample reviews (most recent)
    const samples = (
      row.summaryDocs as Array<{ summary: string | null; createdAt: Date; sentiment: string | null }>
    )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((d) => ({
        summary:   d.summary ?? null,
        createdAt: new Date(d.createdAt).toISOString(),
        sentiment: d.sentiment ?? null,
      }))

    return {
      shopId,
      shopName: shopNameMap[shopId] ?? shopId,
      category,
      count:    row.count as number,
      topSubcategories,
      samples,
    }
  })
}

// ── Regional tree ─────────────────────────────────────────────────────────────

function buildRegionalTree(
  shops: Array<{ _id: string; name: string; city?: string; state?: string }>,
  shopRows: ShopReportRow[],
): RegionalNode[] {
  const rowMap = Object.fromEntries(shopRows.map((r) => [r.id, r]))

  // Group shops by province → city
  const tree: Map<string, Map<string, typeof shops>> = new Map()

  for (const shop of shops) {
    const province = shop.state ?? 'Unknown'
    const city     = shop.city ?? 'Unknown'

    if (!tree.has(province)) tree.set(province, new Map())
    const cities = tree.get(province)!
    if (!cities.has(city)) cities.set(city, [])
    cities.get(city)!.push(shop)
  }

  function aggregateStats(rows: ShopReportRow[]): Omit<RegionalNode, 'name' | 'type' | 'children'> {
    const total      = rows.reduce((s, r) => s + r.total, 0)
    const positive   = rows.reduce((s, r) => s + r.positive, 0)
    const negative   = rows.reduce((s, r) => s + r.negative, 0)
    const complaint  = rows.reduce((s, r) => s + r.complaint, 0)
    const suggestion = rows.reduce((s, r) => s + r.suggestion, 0)
    const ratedShops = rows.filter((r) => r.avgRating !== null)
    const avgRating  = ratedShops.length
      ? parseFloat((ratedShops.reduce((s, r) => s + r.avgRating!, 0) / ratedShops.length).toFixed(2))
      : null
    return { total, positive, negative, complaint, suggestion, avgRating, satisfaction: safeSatisfaction(avgRating) }
  }

  const result: RegionalNode[] = []

  for (const [province, cities] of tree) {
    const cityNodes: RegionalNode[] = []

    for (const [city, cityShops] of cities) {
      const shopNodes: RegionalNode[] = cityShops.map((shop) => {
        const row = rowMap[String(shop._id)]
        return {
          name: shop.name,
          type: 'shop' as const,
          shopId: String(shop._id),
          total:       row?.total      ?? 0,
          positive:    row?.positive   ?? 0,
          negative:    row?.negative   ?? 0,
          complaint:   row?.complaint  ?? 0,
          suggestion:  row?.suggestion ?? 0,
          avgRating:   row?.avgRating  ?? null,
          satisfaction: row?.satisfaction ?? null,
        }
      })

      const cityRows = cityShops.map((s) => rowMap[String(s._id)]).filter(Boolean)
      cityNodes.push({
        name:     city,
        type:     'city',
        children: shopNodes,
        ...aggregateStats(cityRows),
      })
    }

    const allShops   = [...cities.values()].flat()
    const allRows    = allShops.map((s) => rowMap[String(s._id)]).filter(Boolean)
    result.push({
      name:     province,
      type:     'province',
      children: cityNodes,
      ...aggregateStats(allRows),
    })
  }

  return result.sort((a, b) => b.total - a.total)
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function getShopReport(filters: ReportFilters): Promise<ShopReport> {
  await connectDB()

  // 1. Resolve shops matching geographic + explicit shop filters
  const shopQuery: Record<string, unknown> = {}
  if (filters.shopIds?.length)   shopQuery._id   = { $in: filters.shopIds }
  if (filters.provinces?.length) shopQuery.state = { $in: filters.provinces }
  if (filters.cities?.length)    shopQuery.city  = { $in: filters.cities }

  const shops = await Shop.find(shopQuery).lean()
  const shopIds = shops.map((s) => String(s._id))

  if (!shopIds.length) {
    return {
      shops: [], trend: [], heatmap: [], regional: [],
      meta: { dateFrom: filters.dateFrom ?? null, dateTo: filters.dateTo ?? null, totalReviews: 0, shopCount: 0 },
    }
  }

  // 2. Build review match (applied to all review queries)
  const dateMatch = buildDateMatch(filters.dateFrom, filters.dateTo)
  const reviewMatch: Record<string, unknown> = { shopId: { $in: shopIds } }
  if (dateMatch)                   Object.assign(reviewMatch, dateMatch)
  if (filters.categories?.length)  reviewMatch.category  = { $in: filters.categories }
  if (filters.sentiments?.length)  reviewMatch.sentiment = { $in: filters.sentiments }

  // 3. Run all aggregations in parallel
  const [pendingMap, heatmap, trend] = await Promise.all([
    getPendingFollowUps(shopIds, dateMatch),
    buildHeatmap(shops, reviewMatch),
    buildTrendSeries(shops, reviewMatch, filters.dateFrom, filters.dateTo),
  ])

  // 4. Shop rows (needs pendingMap; reviews already loaded inside)
  const shopRows = await buildShopRows(shops, reviewMatch, pendingMap)

  // 5. Build regional tree from shop rows
  const regional = buildRegionalTree(shops, shopRows)

  const totalReviews = shopRows.reduce((s, r) => s + r.total, 0)

  return {
    shops:    shopRows,
    trend,
    heatmap,
    regional,
    meta: {
      dateFrom:     filters.dateFrom  ?? null,
      dateTo:       filters.dateTo    ?? null,
      totalReviews,
      shopCount:    shopRows.filter((s) => s.total > 0).length,
    },
  }
}

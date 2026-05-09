import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'
import path from 'path'

const dbUrl = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), 'dev.db')}`
const adapter = new PrismaBetterSqlite3({ url: dbUrl })
const db = new PrismaClient({ adapter })

// ── Sample data ────────────────────────────────────────────────────────────────

const shops = [
  { tenantId: 'shop-1', name: 'Downtown Branch',  city: 'Lahore',    branchCode: 'LHR-01' },
  { tenantId: 'shop-2', name: 'Mall Road Outlet', city: 'Islamabad', branchCode: 'ISB-01' },
]

type ReviewInput = {
  shopIndex:   number
  sentiment:   string
  category:    string
  subcategory: string
  rating:      number
  items:       string[]
  summary:     string
  keyPoints:   string[]
  lead?: { name: string; email: string; phone: string }
  daysAgo:     number
}

const reviews: ReviewInput[] = [
  // ── Shop 1 — Downtown Branch ───────────────────────────────────────────────
  {
    shopIndex: 0, daysAgo: 1,
    sentiment: 'positive', category: 'general', subcategory: 'great experience', rating: 5,
    items: ['grilled chicken', 'fries'],
    summary: 'Customer had an excellent dining experience. Food was fresh and staff were welcoming.',
    keyPoints: ['Food was hot and fresh', 'Staff greeted warmly', 'Quick service', 'Loved the grilled chicken'],
    lead: { name: 'Ahmed Khan', email: 'ahmed@example.com', phone: '0300-1234567' },
  },
  {
    shopIndex: 0, daysAgo: 2,
    sentiment: 'complaint', category: 'behavioral', subcategory: 'rude cashier', rating: 1,
    items: ['cashier counter'],
    summary: 'Customer complained about a rude and dismissive cashier who ignored their question about the bill.',
    keyPoints: ['Cashier was rude', 'Ignored customer query', 'Did not apologise', 'Will not return'],
    lead: { name: 'Sara Ali', email: 'sara@example.com', phone: '0301-9876543' },
  },
  {
    shopIndex: 0, daysAgo: 3,
    sentiment: 'negative', category: 'product', subcategory: 'cold food', rating: 2,
    items: ['burger', 'nuggets'],
    summary: 'Customer received cold food. Burger was not properly cooked and nuggets were soggy.',
    keyPoints: ['Burger was cold', 'Nuggets were soggy', 'Took 30 minutes to arrive', 'Packaging was torn'],
    lead: { name: 'Usman Raza', email: 'usman@example.com', phone: '0333-4567890' },
  },
  {
    shopIndex: 0, daysAgo: 5,
    sentiment: 'complaint', category: 'facility', subcategory: 'dirty washrooms', rating: 1,
    items: ['washroom'],
    summary: 'Washrooms were extremely dirty and had no soap. Customer was disgusted and left early.',
    keyPoints: ['Washroom not cleaned', 'No soap available', 'Bad smell', 'Manager was unapologetic'],
  },
  {
    shopIndex: 0, daysAgo: 7,
    sentiment: 'positive', category: 'service', subcategory: 'fast delivery', rating: 5,
    items: ['family meal'],
    summary: 'Customer praised the fast and courteous service. Order was correct and arrived in under 10 minutes.',
    keyPoints: ['Order was fast', 'Staff were polite', 'Correct order', 'Great value family meal'],
    lead: { name: 'Fatima Sheikh', email: 'fatima@example.com', phone: '0311-2233445' },
  },
  {
    shopIndex: 0, daysAgo: 10,
    sentiment: 'complaint', category: 'pricing', subcategory: 'overcharged on bill', rating: 2,
    items: ['receipt', 'combo meal'],
    summary: 'Customer was overcharged by Rs. 150 on their combo meal. Manager refused to correct the bill.',
    keyPoints: ['Overcharged Rs. 150', 'Manager unhelpful', 'No receipt provided initially', 'Felt cheated'],
    lead: { name: 'Bilal Chaudhry', email: 'bilal@example.com', phone: '0345-6789012' },
  },
  {
    shopIndex: 0, daysAgo: 14,
    sentiment: 'negative', category: 'service', subcategory: 'long wait time', rating: 2,
    items: ['delivery counter'],
    summary: 'Customer waited over 45 minutes for their order with no updates from staff.',
    keyPoints: ['45 minute wait', 'No status updates', 'Staff seemed confused', 'Order was eventually wrong'],
  },
  {
    shopIndex: 0, daysAgo: 20,
    sentiment: 'positive', category: 'product', subcategory: 'excellent taste', rating: 4,
    items: ['zinger burger', 'coleslaw'],
    summary: 'Customer loved the zinger burger and fresh coleslaw. Only minor complaint was about portion size.',
    keyPoints: ['Zinger was crispy', 'Coleslaw was fresh', 'Portion size could be bigger', 'Good value'],
    lead: { name: 'Maira Tariq', email: 'maira@example.com', phone: '0322-8877665' },
  },
  {
    shopIndex: 0, daysAgo: 25,
    sentiment: 'complaint', category: 'facility', subcategory: 'no parking', rating: 2,
    items: ['parking area'],
    summary: 'Customer could not find parking. The parking area was blocked by staff vehicles.',
    keyPoints: ['Parking blocked by staff cars', 'No valet option', 'Had to park far away', 'Management should fix this'],
  },
  {
    shopIndex: 0, daysAgo: 30,
    sentiment: 'positive', category: 'behavioral', subcategory: 'helpful staff', rating: 5,
    items: ['order counter'],
    summary: 'Staff went out of their way to help a customer with dietary restrictions. Exceptional service.',
    keyPoints: ['Staff asked about allergies', 'Suggested safe options', 'Very knowledgeable', 'Will recommend to friends'],
    lead: { name: 'Nadia Hussain', email: 'nadia@example.com', phone: '0300-5544332' },
  },

  // ── Shop 2 — Mall Road Outlet ──────────────────────────────────────────────
  {
    shopIndex: 1, daysAgo: 1,
    sentiment: 'positive', category: 'general', subcategory: 'amazing ambiance', rating: 5,
    items: ['dining area', 'decor'],
    summary: 'Customer loved the clean, modern ambiance of the outlet. Great place for family dining.',
    keyPoints: ['Clean and modern interior', 'Comfortable seating', 'Good music', 'Family friendly'],
    lead: { name: 'Hamid Iqbal', email: 'hamid@example.com', phone: '0312-3456789' },
  },
  {
    shopIndex: 1, daysAgo: 3,
    sentiment: 'complaint', category: 'product', subcategory: 'wrong order delivered', rating: 1,
    items: ['pizza', 'pasta'],
    summary: 'Customer received the completely wrong order. Pizza was missing toppings and pasta was cold.',
    keyPoints: ['Wrong items delivered', 'Missing toppings', 'Cold pasta', 'No apology from staff'],
    lead: { name: 'Zainab Mirza', email: 'zainab@example.com', phone: '0344-9988776' },
  },
  {
    shopIndex: 1, daysAgo: 5,
    sentiment: 'positive', category: 'service', subcategory: 'excellent service', rating: 5,
    items: ['home delivery'],
    summary: 'Delivery was on time and order was perfectly packed. Driver was polite and professional.',
    keyPoints: ['On-time delivery', 'Perfectly packed', 'Polite driver', 'Hot food upon arrival'],
    lead: { name: 'Omar Farooq', email: 'omar@example.com', phone: '0300-7766554' },
  },
  {
    shopIndex: 1, daysAgo: 8,
    sentiment: 'negative', category: 'facility', subcategory: 'too noisy', rating: 3,
    items: ['dining hall'],
    summary: 'Outlet was extremely noisy during peak hours. Customer could not have a comfortable conversation.',
    keyPoints: ['Too noisy at lunch', 'Echo in the hall', 'Tables too close together', 'Food was good though'],
  },
  {
    shopIndex: 1, daysAgo: 12,
    sentiment: 'complaint', category: 'behavioral', subcategory: 'ignored by staff', rating: 1,
    items: ['service counter'],
    summary: 'Customer stood at the counter for 10 minutes and was completely ignored by three staff members.',
    keyPoints: ['Waited 10 minutes ignored', 'Staff were on phones', 'Had to ask loudly to be served', 'Felt disrespected'],
    lead: { name: 'Ayesha Siddiqui', email: 'ayesha@example.com', phone: '0321-1122334' },
  },
  {
    shopIndex: 1, daysAgo: 15,
    sentiment: 'positive', category: 'product', subcategory: 'fresh ingredients', rating: 4,
    items: ['salad', 'grilled fish'],
    summary: 'Customer was impressed by the freshness of ingredients. Salad was crisp and grilled fish was perfectly cooked.',
    keyPoints: ['Very fresh salad', 'Perfectly grilled fish', 'Healthy menu options', 'Slightly expensive'],
    lead: { name: 'Tariq Mehmood', email: 'tariq@example.com', phone: '0333-6655443' },
  },
  {
    shopIndex: 1, daysAgo: 18,
    sentiment: 'negative', category: 'pricing', subcategory: 'no change given', rating: 2,
    items: ['cashier'],
    summary: 'Cashier did not have change and asked the customer to pay extra. Customer found this unacceptable.',
    keyPoints: ['No change available', 'Asked to round up payment', 'Happens frequently', 'Management should fix'],
  },
  {
    shopIndex: 1, daysAgo: 22,
    sentiment: 'positive', category: 'general', subcategory: 'great for meetings', rating: 4,
    items: ['private seating area'],
    summary: 'Customer used the outlet for a business lunch. Private seating area was ideal and WiFi was good.',
    keyPoints: ['Good WiFi', 'Private seating available', 'Quiet corner area', 'Coffee was excellent'],
    lead: { name: 'Sana Baig', email: 'sana@example.com', phone: '0300-4433221' },
  },
  {
    shopIndex: 1, daysAgo: 28,
    sentiment: 'complaint', category: 'facility', subcategory: 'broken AC', rating: 2,
    items: ['dining area AC'],
    summary: 'Air conditioning was not working during a hot afternoon. Customer and family were very uncomfortable.',
    keyPoints: ['AC not working', 'Very hot inside', 'Staff knew but did nothing', 'Food was fine'],
  },
  {
    shopIndex: 1, daysAgo: 35,
    sentiment: 'positive', category: 'behavioral', subcategory: 'manager resolved complaint', rating: 4,
    items: ['management'],
    summary: 'Manager personally came to resolve a previous complaint and offered a complimentary dessert. Customer appreciated.',
    keyPoints: ['Manager took initiative', 'Offered complimentary dessert', 'Professional handling', 'Restored customer trust'],
    lead: { name: 'Kamran Javed', email: 'kamran@example.com', phone: '0311-5544332' },
  },
]

// ── Seed function ──────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...\n')

  // Upsert shops
  const shopRecords = []
  for (const s of shops) {
    const shop = await db.shop.upsert({
      where:  { tenantId: s.tenantId },
      update: { name: s.name, city: s.city, branchCode: s.branchCode },
      create: s,
    })
    shopRecords.push(shop)
    console.log(`  ✓ Shop: ${shop.name} (${shop.city})`)
  }

  // Clear existing seed reviews to avoid duplicates on re-run
  const shopIds = shopRecords.map((s) => s.id)
  const existing = await db.review.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } })
  if (existing.length > 0) {
    await db.lead.deleteMany({ where: { reviewId: { in: existing.map((r) => r.id) } } })
    await db.review.deleteMany({ where: { shopId: { in: shopIds } } })
    console.log(`\n  ↺  Cleared ${existing.length} existing reviews\n`)
  }

  // Insert reviews
  let count = 0
  for (const r of reviews) {
    const shop      = shopRecords[r.shopIndex]
    const createdAt = new Date(Date.now() - r.daysAgo * 86400_000)

    const review = await db.review.create({
      data: {
        shopId:      shop.id,
        sentiment:   r.sentiment,
        category:    r.category,
        subcategory: r.subcategory,
        rating:      r.rating,
        items:       JSON.stringify(r.items),
        summary:     r.summary,
        keyPoints:   JSON.stringify(r.keyPoints),
        createdAt,
      },
    })

    if (r.lead) {
      await db.lead.create({
        data: { reviewId: review.id, ...r.lead },
      })
    }

    count++
    const icon = r.sentiment === 'positive' ? '✅' : r.sentiment === 'complaint' ? '🚨' : '⚠️'
    console.log(`  ${icon} [${shop.name}] ${r.category} · ${r.subcategory} (${r.rating}★)`)
  }

  console.log(`\n✅ Seeded ${shopRecords.length} shops and ${count} reviews.\n`)
  console.log('Dashboard → http://localhost:3000/dashboard\n')
}

seed()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())

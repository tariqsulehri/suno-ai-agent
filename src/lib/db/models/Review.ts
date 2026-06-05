import mongoose, { Schema, Model } from 'mongoose'

export interface IReview {
  _id: string
  shopId: string
  sentiment?: string   // positive | negative | complaint | suggestion
  category?: string    // product | service | behavioral | facility | pricing | general
  subcategory?: string
  rating?: number      // 1–5
  items?: string       // JSON: string[]
  summary?: string
  keyPoints?: string   // JSON: string[]
  transcript?: string  // JSON: ChatHistory
  status: string       // pending | contacted | resolved
  ticketId?: string
  ticketType?: string
  ticketPriority?: string
  slaDueAt?: Date
  createdAt: Date
}

const ReviewSchema = new Schema<IReview>(
  {
    _id:           { type: String, default: () => crypto.randomUUID() },
    shopId:        { type: String, required: true, ref: 'Shop', index: true },
    sentiment:     String,
    category:      String,
    subcategory:   String,
    rating:        Number,
    items:         String,
    summary:       String,
    keyPoints:     String,
    transcript:    String,
    status:        { type: String, default: 'pending' },
    ticketId:      { type: String, unique: true, sparse: true },
    ticketType:    String,
    ticketPriority: String,
    slaDueAt:      Date,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

export const Review: Model<IReview> =
  mongoose.models.Review ?? mongoose.model<IReview>('Review', ReviewSchema)

import mongoose, { Schema, Model } from 'mongoose'

export interface ILead {
  _id: string
  reviewId: string
  name?: string
  email?: string
  phone?: string
  createdAt: Date
}

const LeadSchema = new Schema<ILead>(
  {
    _id:      { type: String, default: () => crypto.randomUUID() },
    reviewId: { type: String, required: true, unique: true, ref: 'Review' },
    name:     String,
    email:    String,
    phone:    String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

export const Lead: Model<ILead> =
  mongoose.models.Lead ?? mongoose.model<ILead>('Lead', LeadSchema)

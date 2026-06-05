import mongoose, { Schema, Model } from 'mongoose'

export interface IShop {
  _id: string
  tenantId: string
  name: string
  city?: string
  address?: string
  branchCode?: string
  state?: string
  town?: string
  phone?: string
  mobile?: string
  email?: string
  lat?: number
  lng?: number
  createdAt: Date
}

const ShopSchema = new Schema<IShop>(
  {
    _id:        { type: String, default: () => crypto.randomUUID() },
    tenantId:   { type: String, required: true, unique: true },
    name:       { type: String, required: true },
    city:       String,
    address:    String,
    branchCode: String,
    state:      String,
    town:       String,
    phone:      String,
    mobile:     String,
    email:      String,
    lat:        Number,
    lng:        Number,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

export const Shop: Model<IShop> =
  mongoose.models.Shop ?? mongoose.model<IShop>('Shop', ShopSchema)

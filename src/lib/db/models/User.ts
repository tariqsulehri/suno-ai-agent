import mongoose, { Schema, Model } from 'mongoose'

export interface IUser {
  _id: string
  username: string
  passwordHash: string
  role: string        // agent | manager | admin
  tenantId?: string
  shopId?: string
  active: boolean
  demoPassword?: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    _id:          { type: String, default: () => crypto.randomUUID() },
    username:     { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, required: true },
    tenantId:     String,
    shopId:       { type: String, ref: 'Shop' },
    active:       { type: Boolean, default: true },
    demoPassword: String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
)

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)

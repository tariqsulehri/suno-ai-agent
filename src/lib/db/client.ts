export { connectDB } from './connection'
export { Shop, User, Review, Lead } from './models'
export type { IShop, IUser, IReview, ILead } from './models'

// Vector search is not available with MongoDB Atlas in this deployment.
// Set to true and wire up Atlas Search to re-enable.
export function isVectorsEnabled(): boolean {
  return false
}

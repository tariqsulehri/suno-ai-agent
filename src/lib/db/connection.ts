import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('MONGODB_URI env var is not set')

// Reuse connection across Next.js hot-reloads in dev
const g = globalThis as unknown as { mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } }

if (!g.mongoose) {
  g.mongoose = { conn: null, promise: null }
}

export async function connectDB(): Promise<typeof mongoose> {
  if (g.mongoose!.conn) return g.mongoose!.conn

  if (!g.mongoose!.promise) {
    g.mongoose!.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    })
  }

  g.mongoose!.conn = await g.mongoose!.promise
  return g.mongoose!.conn
}

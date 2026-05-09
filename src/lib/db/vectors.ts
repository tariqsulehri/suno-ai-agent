import { rawDb } from './client'

// text-embedding-3-small produces 1536-dimension vectors
const VECTOR_DIM = 1536

/**
 * Creates the vec0 virtual table if it doesn't exist.
 * Safe to call on every boot — uses IF NOT EXISTS.
 *
 * vec0 is a sqlite-vec virtual table that supports:
 *   - INSERT of float32 vectors
 *   - KNN search via "WHERE embedding MATCH ?" ORDER BY distance
 */
export function initVectorTable() {
  rawDb.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_reviews USING vec0(
      review_id TEXT PRIMARY KEY,
      embedding FLOAT[${VECTOR_DIM}]
    )
  `)
}

/**
 * Store a review's embedding vector.
 * Called right after the Review row is created in SQLite.
 */
export function upsertReviewVector(reviewId: string, embedding: number[]) {
  const vec = new Float32Array(embedding)
  rawDb
    .prepare(`INSERT OR REPLACE INTO vec_reviews(review_id, embedding) VALUES (?, ?)`)
    .run(reviewId, vec)
}

/**
 * Find the K most semantically similar reviews to a query embedding.
 * Returns review IDs ordered by cosine distance (closest first).
 */
export function searchSimilarReviews(
  queryEmbedding: number[],
  limit = 5
): { review_id: string; distance: number }[] {
  const vec = new Float32Array(queryEmbedding)
  return rawDb
    .prepare(`
      SELECT review_id, distance
      FROM vec_reviews
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `)
    .all(vec, limit) as { review_id: string; distance: number }[]
}

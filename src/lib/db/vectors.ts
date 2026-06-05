// Vector search is disabled — sqlite-vec is not available with MongoDB.
// Re-implement using MongoDB Atlas Search when needed.

export function initVectorTable(): void {}

export function upsertReviewVector(_reviewId: string, _embedding: number[]): void {}

export function searchSimilarReviews(
  _queryEmbedding: number[],
  _limit = 5,
): { review_id: string; distance: number }[] {
  return []
}

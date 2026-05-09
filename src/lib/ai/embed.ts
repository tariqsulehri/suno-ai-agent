import { getOpenAIClient } from './client'
import type { ReviewData } from '@/types'

/**
 * Generate a 1536-dimension embedding for a review using text-embedding-3-small.
 * Combines all meaningful review fields into one rich text blob.
 */
export async function embedReview(
  review: ReviewData | null,
  summary: string,
  keyPoints: string[],
  apiKey?: string
): Promise<number[]> {
  const parts: string[] = []

  if (review?.sentiment)   parts.push(`Sentiment: ${review.sentiment}`)
  if (review?.category)    parts.push(`Category: ${review.category}`)
  if (review?.subcategory) parts.push(`Issue: ${review.subcategory}`)
  if (review?.rating)      parts.push(`Rating: ${review.rating} out of 5`)
  if (review?.items?.length) parts.push(`Items mentioned: ${review.items.join(', ')}`)
  if (summary)             parts.push(`Summary: ${summary}`)
  if (keyPoints.length)    parts.push(`Key points: ${keyPoints.join('. ')}`)

  const input = parts.join('\n')

  const client   = getOpenAIClient(apiKey)
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input,
  })

  return response.data[0].embedding
}

/**
 * Generate a 1536-dimension embedding for a plain text query.
 * Used when the manager asks a natural language question.
 */
export async function embedQuery(query: string, apiKey?: string): Promise<number[]> {
  const client   = getOpenAIClient(apiKey)
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })

  return response.data[0].embedding
}

type AiErrorLike = {
  status?: number
  code?: string
  message?: string
}

function toAiError(err: unknown): AiErrorLike {
  if (err && typeof err === 'object') return err as AiErrorLike
  return { message: String(err) }
}

export function isMissingProviderError(err: unknown, provider: string): boolean {
  return String(toAiError(err).message || err).includes(provider)
}

export function isInvalidApiKeyError(err: unknown): boolean {
  const error = toAiError(err)
  const message = String(error.message || err).toLowerCase()
  return error.status === 401 || error.code === 'invalid_api_key' || message.includes('invalid api key')
}

export function isQuotaError(err: unknown): boolean {
  const error = toAiError(err)
  return error.status === 429 || String(error.message || err).includes('429')
}

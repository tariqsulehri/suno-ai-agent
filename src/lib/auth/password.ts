const enc = new TextEncoder()

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = process.env.SESSION_SALT ?? 'va-dashboard-2025'
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(`${password}:${salt}`)))
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await hashPassword(password) === hash
}

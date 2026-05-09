export interface KBEntry {
  topic: string
  content: string
}

export interface EmailNotificationConfig {
  enabled: boolean
  smtp: {
    host: string
    port: number
    secure: boolean
    userEnv: string
    passEnv: string
  }
  fromName: string
  fromEmail: string
  recipients?: string[]
  sendToLeadEmail?: boolean
}

export interface TenantConfig {
  // ── Identity & Auth ──────────────────────────────────────────────────────────
  id: string
  token?: string           // paired with x-embed-tenant header
  apiKeys?: string[]       // standalone x-api-key auth
  allowedDomains?: string[] // domain-based implicit auth (no token needed)
  openaiApiKey?:  string    // tenant-supplied OpenAI key; falls back to server env key

  // ── Persona ──────────────────────────────────────────────────────────────────
  agentType?: 'support' | 'complaints' | 'reviews'  // defaults to 'support'
  agentName: string
  companyName: string
  languageMode: 'auto' | string        // "auto" or a specific language e.g. "english"
  supportedLanguages?: string[]        // e.g. ["english", "urdu", "hindi"]
  languageVoices?: Record<string, string> // e.g. { "urdu": "echo", "hindi": "echo" }
  tone: string                         // e.g. "friendly, expert"

  // ── TTS ──────────────────────────────────────────────────────────────────────
  ttsProvider: 'openai' | 'elevenlabs'
  ttsVoice: string
  voiceProfile?: {
    gender: 'female' | 'male' | 'neutral'
    style?: string
  }

  // ── Knowledge ────────────────────────────────────────────────────────────────
  services: string[]
  customInstructions?: string
  knowledgeBase?: KBEntry[]

  // ── Conversation ─────────────────────────────────────────────────────────────
  greeting?: string  // exact first message — bypasses LLM, guaranteed verbatim

  // ── Notifications ────────────────────────────────────────────────────────────
  emailNotifications?: EmailNotificationConfig

}

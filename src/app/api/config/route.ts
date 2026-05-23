import { NextRequest, NextResponse } from 'next/server'
import { getLangConfig } from '@/lib/config/language'
import { resolveTenantTtsVoice } from '@/lib/config/voice'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { getSessionFromRequest } from '@/lib/auth/session'
import { getTenantById } from '@/lib/tenants/registry'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  const sessionTenant = session?.role === 'agent' && session.tenantId
    ? getTenantById(session.tenantId)
    : null

  const authError = sessionTenant ? null : requireEmbedApiAuth(req)
  if (authError) return authError

  const tenant = sessionTenant ?? getTenantFromRequest(req)
  const lang   = getLangConfig(tenant.languageMode)

  return NextResponse.json({
    language:    lang.name,
    ttsProvider: tenant.ttsProvider,
    voice:       resolveTenantTtsVoice(tenant),
    voiceGender: tenant.voiceProfile?.gender ?? null,
    agentName:   tenant.agentName,
    companyName: tenant.companyName,
    greeting:    tenant.greeting ?? null,
  })
}

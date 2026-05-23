import type { AppRole, AppSession } from './session'

export function hasRole(session: AppSession | null, roles: AppRole[]) {
  return Boolean(session && roles.includes(session.role))
}

export function dashboardScope(session: AppSession) {
  return session.role === 'manager' ? { shopId: session.shopId } : { shopId: null }
}

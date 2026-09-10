import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env.js'

export interface GoogleIdentity {
  sub: string
  email: string
  name: string
  picture?: string
  emailVerified: boolean
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity> {
  if (!env.googleAuth.enabled || !env.googleAuth.clientId) {
    throw Object.assign(new Error('google_auth_disabled'), { code: 'google_auth_disabled' })
  }

  const client = new OAuth2Client(env.googleAuth.clientId)
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.googleAuth.clientId,
  })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw Object.assign(new Error('invalid_google_token'), { code: 'invalid_google_token' })
  }
  if (payload.email_verified !== true) {
    throw Object.assign(new Error('email_not_verified'), { code: 'email_not_verified' })
  }

  const iss = payload.iss || ''
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(iss)) {
    throw Object.assign(new Error('invalid_issuer'), { code: 'invalid_issuer' })
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture,
    emailVerified: true,
  }
}

export function googleAuthPublicConfig() {
  return {
    enabled: Boolean(env.googleAuth.enabled && env.googleAuth.clientId),
    oneTapEnabled: Boolean(
      env.googleAuth.enabled && env.googleAuth.oneTapEnabled && env.googleAuth.clientId,
    ),
    clientId: env.googleAuth.enabled ? env.googleAuth.clientId : '',
  }
}

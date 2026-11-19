import { decodeJwt, errors, jwtVerify, SignJWT } from 'jose';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DOCUMENT_LINK_AUDIENCE, DOCUMENT_LINK_TTL } from 'utils/lib/types/api/document-link.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';

const MIN_DOCUMENT_LINK_SECRET_LENGTH = 32;

/** An unset `#{var/DOCUMENT_LINK_SECRET}` deploys as its own literal text, a key anyone can read in the repo. */
export function requireDocumentLinkSigningKey(secrets: Secrets | null): Uint8Array {
  const secret = getSecret(SecretsKeys.DOCUMENT_LINK_SECRET, secrets);
  if (secret.length < MIN_DOCUMENT_LINK_SECRET_LENGTH) {
    throw new Error(
      `DOCUMENT_LINK_SECRET must be a random string of at least ${MIN_DOCUMENT_LINK_SECRET_LENGTH} characters`
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * The emailed link carries only this token. Its subject is the attempt Task, from which `open-document-link`
 * resolves the document and the recipient; the HMAC signature is what makes the URL unguessable.
 */
export async function mintDocumentLinkToken(attemptTaskId: string, secrets: Secrets | null): Promise<string> {
  const secret = requireDocumentLinkSigningKey(secrets);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(attemptTaskId)
    .setIssuer(PROJECT_WEBSITE)
    .setAudience(DOCUMENT_LINK_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(DOCUMENT_LINK_TTL)
    .sign(secret);
}

export async function verifyDocumentLinkToken(
  token: string,
  secrets: Secrets | null
): Promise<{ attemptId: string; expired: boolean }> {
  const secret = requireDocumentLinkSigningKey(secrets);
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: PROJECT_WEBSITE, audience: DOCUMENT_LINK_AUDIENCE });
    if (!payload.sub) throw NOT_AUTHORIZED;
    return { attemptId: payload.sub, expired: false };
  } catch (error) {
    // jose checks the signature before the claims, so an expired token is still provably ours.
    if (error instanceof errors.JWTExpired) {
      const { sub } = decodeJwt(token);
      if (sub) return { attemptId: sub, expired: true };
    }
    console.error('Document link token rejected:', error instanceof Error ? error.message : error);
    throw NOT_AUTHORIZED;
  }
}

/**
 * The token travels in the URL fragment: it never reaches the intake host's access logs, proxies or error
 * telemetry, and the intake client treats a `?token=` query parameter as a bearer token.
 */
export const makeDocumentLinkUrl = (token: string, secrets: Secrets | null): string =>
  `${getSecret(SecretsKeys.WEBSITE_URL, secrets)}/documents#${token}`;

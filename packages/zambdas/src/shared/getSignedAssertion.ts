import { DateTime } from 'luxon';
import { Secrets } from '../types';
import { getSecret, SecretsKeys } from './secrets';
import { importPKCS8, SignJWT } from 'jose';
import { randomBytes } from 'crypto';

export const getSignedAssertion = async (secrets: Secrets | null): Promise<string> => {
  const aud = 'https://api.redoxengine.com/v2/auth/token';
  const privateKeyPEM = getSecret(SecretsKeys.REDOX_OAUTH_PRIVATE_KEY, secrets);
  const privateKey = await importPKCS8(privateKeyPEM, 'RS384');
  const iat = Math.floor(DateTime.now().toSeconds());

  const scope = getSecret(SecretsKeys.REDOX_OAUTH_SCOPE, secrets);
  const payload = {
    scope,
  };

  const clientId = getSecret(SecretsKeys.REDOX_OAUTH_CLIENT_ID, secrets);
  const kid = getSecret(SecretsKeys.REDOX_OAUTH_KID, secrets);

  console.log(clientId, kid);

  const signedAssertion = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'RS384',
      kid: kid,
    })
    .setAudience(aud)
    .setIssuer(clientId)
    .setSubject(clientId)
    .setIssuedAt(iat)
    .setJti(randomBytes(8).toString('hex')) // a random string to prevent replay attacks
    .sign(privateKey);

  return signedAssertion;
};

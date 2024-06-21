import { User } from '@zapehr/sdk';
import { createAppClient, getAuth0Token } from 'ottehr-utils';
import { Secrets, SecretsKeys, getSecret } from 'ottehr-utils';

export async function getM2MClientToken(secrets: Secrets | null): Promise<string> {
  const clientIdKey = SecretsKeys.TELEMED_CLIENT_ID;
  const secretIdKey = SecretsKeys.TELEMED_CLIENT_SECRET;

  return getAuth0Token({
    clientIdKey,
    secretIdKey,
    secrets,
  });
}

export async function getUser(token: string): Promise<User> {
  const appClient = createAppClient(token);
  const user = await appClient.getMe();
  return user;
}

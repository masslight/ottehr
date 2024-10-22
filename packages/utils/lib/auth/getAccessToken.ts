import { Secrets, SecretsKeys } from '../secrets';
import { getAuth0Token } from './getAuth0Token';

export type AuthType = 'regular' | 'messaging';

export async function getAccessToken(secrets: Secrets | null, type: AuthType = 'regular'): Promise<string> {
    let clientIdKey: SecretsKeys.TELEMED_CLIENT_ID | SecretsKeys.MESSAGING_M2M_CLIENT;
    let secretIdKey: SecretsKeys.TELEMED_CLIENT_SECRET | SecretsKeys.MESSAGING_M2M_SECRET;
    if (type === 'regular') {
      clientIdKey = SecretsKeys.TELEMED_CLIENT_ID;
      secretIdKey = SecretsKeys.TELEMED_CLIENT_SECRET;
    } else if (type === 'messaging') {
      clientIdKey = SecretsKeys.MESSAGING_M2M_CLIENT;
      secretIdKey = SecretsKeys.MESSAGING_M2M_SECRET;
    } else {
      console.log('unknown m2m token type');
      throw Error('unknown m2m token type');
    }
    return getAuth0Token({ secretIdKey, clientIdKey, secrets });
  }
import { Secrets, SecretsKeys } from '../secrets';
import { getAuth0Token } from './getAuth0Token';

export type AuthType = 'regular' | 'messaging';

export async function getAccessToken(secrets: Secrets | null, type: AuthType = 'regular'): Promise<string> {
    let clientIdKey: SecretsKeys.AUTH0_CLIENT | SecretsKeys.URGENT_CARE_MESSAGING_M2M_CLIENT;
    let secretIdKey: SecretsKeys.AUTH0_SECRET | SecretsKeys.URGENT_CARE_MESSAGING_M2M_SECRET;
    if (type === 'regular') {
      clientIdKey = SecretsKeys.AUTH0_CLIENT;
      secretIdKey = SecretsKeys.AUTH0_SECRET;
    } else if (type === 'messaging') {
      clientIdKey = SecretsKeys.URGENT_CARE_MESSAGING_M2M_CLIENT;
      secretIdKey = SecretsKeys.URGENT_CARE_MESSAGING_M2M_SECRET;
    } else {
      console.log('unknown m2m token type');
      throw Error('unknown m2m token type');
    }
    return getAuth0Token({ secretIdKey, clientIdKey, secrets });
  }
import { userMe } from 'utils/lib/auth/user-me.helper';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';

export async function getMyPractitionerId(token: string, secrets: Secrets | null): Promise<string> {
  const myPractitionerId = removePrefix('Practitioner/', (await userMe(token, secrets)).profile);
  if (!myPractitionerId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractitionerId;
}

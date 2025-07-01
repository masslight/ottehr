import Oystehr from '@oystehr/sdk';
import { removePrefix } from 'utils';

export async function getMyPractitionerId(oystehr: Oystehr): Promise<string> {
  const myPractitionerId = removePrefix('Practitioner/', (await oystehr.user.me()).profile);
  if (!myPractitionerId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractitionerId;
}

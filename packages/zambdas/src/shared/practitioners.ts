import Oystehr from '@oystehr/sdk';
import { removePrefix, User } from 'utils';

export async function getMyPractitionerId(oystehr: Oystehr): Promise<string> {
  const myPractitionerId = removePrefix('Practitioner/', (await oystehr.user.me()).profile);
  if (!myPractitionerId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractitionerId;
}

export async function getCurUserAndPractitionerId(
  oystehr: Oystehr
): Promise<{ curUser: User; curUserPractitionerId: string }> {
  const curUser = await oystehr.user.me();
  const curUserPractitionerId = removePrefix('Practitioner/', curUser.profile);
  if (!curUserPractitionerId) throw new Error('Could not parse resource id attached to current user');
  return { curUser, curUserPractitionerId };
}

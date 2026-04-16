import Oystehr from '@oystehr/sdk';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../shared';

let m2mToken: string;

export const PRACTICE_MANAGED_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/questionnaire-type',
  code: 'practice-managed',
};

export async function getClient(input: ZambdaInput): Promise<Oystehr> {
  if (!input.secrets) throw new Error('No secrets provided');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  return createOystehrClient(m2mToken, input.secrets);
}

import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface ErxPatientSyncSubscriptionInput {
  patientId: string;
  encounterId: string;
  // 'encounter' = the visit (arrived) trigger; 'observation' = the height/weight vitals trigger.
  triggerType: 'encounter' | 'observation';
  secrets: Secrets;
}

const referenceSchema = z.object({
  reference: z.string(),
});

// this zambda has two subscriptions:
// - encounter trigger filtered by demographics
// - observation trigger filtered by vitals
const ErxSyncBodySchema = z.discriminatedUnion('resourceType', [
  z
    .object({
      resourceType: z.literal('Encounter'),
      id: z.string(),
      subject: referenceSchema,
    })
    .passthrough(),
  z
    .object({
      resourceType: z.literal('Observation'),
      id: z.string(),
      subject: referenceSchema,
      encounter: referenceSchema,
    })
    .passthrough(),
]);

export function validateRequestParameters(input: ZambdaInput): ErxPatientSyncSubscriptionInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const secrets = input.secrets;
  const body = safeValidate(ErxSyncBodySchema, JSON.parse(input.body));
  const triggerType: 'encounter' | 'observation' = body.resourceType.toLocaleLowerCase() as 'encounter' | 'observation';

  const patientId = body.subject.reference.split('/')[1];
  if (!patientId) {
    throw new Error(`Patient reference not found on ${triggerType} ${body.id}`);
  }

  // resourceType = 'Encounter'
  let encounterId = body.id;
  if (body.resourceType === 'Observation') {
    encounterId = body.encounter.reference.split('/')[1];
  }
  if (!encounterId) {
    throw new Error(`Encounter reference not found on ${triggerType} ${body.id}`);
  }

  return {
    patientId,
    encounterId,
    triggerType,
    secrets,
  };
}

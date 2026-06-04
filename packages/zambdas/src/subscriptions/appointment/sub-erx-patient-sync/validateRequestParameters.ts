import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface ErxPatientSyncSubscriptionInput {
  patientId: string;
  encounterId?: string;
  secrets: Secrets;
}

const referenceSchema = z.object({
  reference: z.string(),
});

// this zambda has two subscriptions:
// - patient (demographics) trigger without an encounter
// - observation (height/weight) trigger with an encounter
const ErxSyncBodySchema = z.discriminatedUnion('resourceType', [
  z
    .object({
      resourceType: z.literal('Patient'),
      id: z.string(),
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

  if (body.resourceType === 'Observation') {
    const patientId = body.subject.reference.split('/')[1];
    const encounterId = body.encounter.reference.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient reference not found on observation ${body.id}`);
    }
    if (!encounterId) {
      throw new Error(`Encounter reference not found on observation ${body.id}`);
    }
    return {
      patientId,
      encounterId,
      secrets,
    };
  }

  return {
    patientId: body.id,
    secrets,
  };
}

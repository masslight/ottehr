import { GetPatientBalancesZambdaInput, MISSING_REQUEST_BODY, NOT_AUTHORIZED, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, shouldUseOttehrBillingForPatientBalances, ZambdaInput } from '../../shared';

const GetPatientBalancesBodySchema = z.object({
  patientId: z.string().uuid(),
});

export interface ValidatedInput {
  body: GetPatientBalancesZambdaInput;
  callerAccessToken: string;
}

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const callerAccessToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!callerAccessToken) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const body = safeValidate(GetPatientBalancesBodySchema, parsed);

  return {
    body,
    callerAccessToken,
  };
};

const SecretsSchema = z.object({
  AUTH0_ENDPOINT: z.string().min(1),
  AUTH0_CLIENT: z.string().min(1),
  AUTH0_SECRET: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  FHIR_API: z.string().min(1),
  PROJECT_API: z.string().min(1),
  PATIENT_BALANCE_SOURCE: z.string().optional(),
});

const CandidSecretsSchema = SecretsSchema.extend({
  CANDID_CLIENT_ID: z.string().min(1),
  CANDID_CLIENT_SECRET: z.string().min(1),
  CANDID_ENV: z.string().min(1),
});

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  try {
    const schema = shouldUseOttehrBillingForPatientBalances(secrets) ? SecretsSchema : CandidSecretsSchema;
    return schema.parse(secrets);
  } catch {
    throw new Error('Missing required secrets');
  }
};

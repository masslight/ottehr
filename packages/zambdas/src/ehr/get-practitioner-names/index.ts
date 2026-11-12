import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  GetPractitionerNamesInputSchema,
  GetPractitionerNamesResponse,
} from 'utils/lib/types/api/practitioner-names.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { fetchPractitionerFirstLastNames } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

const ZAMBDA_NAME = 'get-practitioner-names';

let m2mToken: string;

// The EHR's door to Practitioner names for callers that cannot read clinical FHIR: the billing
// zambdas invoke it over the wire to name who took, refunded or voided a payment.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { practitionerIds, secrets } = validateWithSchema(GetPractitionerNamesInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  return lambdaResponse(200, await performEffect(oystehr, practitionerIds));
});

export const performEffect = async (
  oystehr: Oystehr,
  practitionerIds: string[]
): Promise<GetPractitionerNamesResponse> => ({
  names: Object.fromEntries(await fetchPractitionerFirstLastNames(oystehr, practitionerIds)),
});

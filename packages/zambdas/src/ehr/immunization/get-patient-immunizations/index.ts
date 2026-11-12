import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  GetPatientImmunizationsRequest,
  GetPatientImmunizationsResponse,
} from 'utils/lib/types/data/immunization/types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  assertImmunizationStaff,
  buildPatientImmunizationsResponse,
  searchPatientImmunizations,
  validateFhirId,
} from '../records';

let m2mToken: string;

const ZAMBDA_NAME = 'get-patient-immunizations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  await assertImmunizationStaff(input, 'read immunization records');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const response = await getPatientImmunizations(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/** The patient's doses (given here, outside, undated) and marks with their history, for the engine and the UI. */
export async function getPatientImmunizations(
  oystehr: Oystehr,
  input: GetPatientImmunizationsRequest
): Promise<GetPatientImmunizationsResponse> {
  return buildPatientImmunizationsResponse(await searchPatientImmunizations(oystehr, input.patientId));
}

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientImmunizationsRequest & Pick<ZambdaInput, 'secrets'> {
  const { patientId } = validateJsonBody(input);
  return { patientId: validateFhirId(patientId, 'patientId'), secrets: input.secrets };
}

import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Immunization, Reference } from 'fhir/r4b';
import { ClearImmunizationMarkRequest, ClearImmunizationMarkResponse } from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { assertImmunizationStaff, clearImmunizationMark, validateFhirId } from '../records';

let m2mToken: string;

const ZAMBDA_NAME = 'clear-immunization-mark';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  await assertImmunizationStaff(input, 'clear immunization exceptions');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const clearedBy = await resolveCallerPractitionerRef(getUserToken(input), validatedParameters.secrets, oystehr);
  const response = await clearMark(oystehr, validatedParameters, clearedBy);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function clearMark(
  oystehr: Oystehr,
  input: ClearImmunizationMarkRequest,
  clearedBy: Reference
): Promise<ClearImmunizationMarkResponse> {
  let mark: Immunization;
  try {
    mark = await oystehr.fhir.get<Immunization>({ resourceType: 'Immunization', id: input.markId });
  } catch (error) {
    console.error('Failed to read the mark to clear:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Immunization');
  }
  const cleared = await oystehr.fhir.update<Immunization>(clearImmunizationMark(mark, clearedBy));
  return { markId: cleared.id! };
}

export function validateRequestParameters(
  input: ZambdaInput
): ClearImmunizationMarkRequest & Pick<ZambdaInput, 'secrets'> {
  const { markId } = validateJsonBody(input);
  return { markId: validateFhirId(markId, 'markId'), secrets: input.secrets };
}

import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Immunization, Reference } from 'fhir/r4b';
import { createReference } from 'utils/lib/fhir/helpers';
import {
  RecordOutsideImmunizationRequest,
  RecordOutsideImmunizationResponse,
} from 'utils/lib/types/data/immunization/types';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  assertImmunizationStaff,
  buildOutsideImmunization,
  validateFhirId,
  validateOutsideImmunizationDetails,
} from '../records';

let m2mToken: string;

const ZAMBDA_NAME = 'record-outside-immunization';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  await assertImmunizationStaff(input, 'record immunizations');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const recorder = await resolveCallerPractitionerRef(getUserToken(input), validatedParameters.secrets, oystehr);
  const response = await recordOutsideImmunization(oystehr, validatedParameters, recorder);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/** The patient is the encounter's: the client names only the visit the dose is recorded at. */
export async function recordOutsideImmunization(
  oystehr: Oystehr,
  input: RecordOutsideImmunizationRequest,
  recorder: Reference
): Promise<RecordOutsideImmunizationResponse> {
  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: input.encounterId });
  if (!encounter.subject) {
    throw new Error(`Encounter ${encounter.id} has no subject`);
  }
  const immunization = await oystehr.fhir.create<Immunization>(
    buildOutsideImmunization(input, encounter.subject, createReference(encounter), recorder)
  );
  return { immunizationId: immunization.id! };
}

export function validateRequestParameters(
  input: ZambdaInput
): RecordOutsideImmunizationRequest & Pick<ZambdaInput, 'secrets'> {
  const body = validateJsonBody(input);
  return {
    encounterId: validateFhirId(body.encounterId, 'encounterId'),
    ...validateOutsideImmunizationDetails(body),
    secrets: input.secrets,
  };
}

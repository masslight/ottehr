import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Immunization, Patient, Reference } from 'fhir/r4b';
import { createReference } from 'utils/lib/fhir/helpers';
import { SaveImmunizationMarkRequest, SaveImmunizationMarkResponse } from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  activeMarkForGroup,
  assertImmunizationStaff,
  buildImmunizationMark,
  clearImmunizationMark,
  searchPatientImmunizations,
  validateImmunizationMarkInput,
} from '../records';

let m2mToken: string;

const ZAMBDA_NAME = 'save-immunization-mark';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  await assertImmunizationStaff(input, 'mark immunizations');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const recorder = await resolveCallerPractitionerRef(getUserToken(input), validatedParameters.secrets, oystehr);
  const response = await saveImmunizationMark(oystehr, validatedParameters, recorder);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/** One active mark per vaccine group: a new mark clears the active one (which stays in the history). */
export async function saveImmunizationMark(
  oystehr: Oystehr,
  input: SaveImmunizationMarkRequest,
  recorder: Reference
): Promise<SaveImmunizationMarkResponse> {
  let patient: Patient;
  try {
    patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: input.patientId });
  } catch (error) {
    console.error('Failed to read the patient to mark:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  const active = activeMarkForGroup(await searchPatientImmunizations(oystehr, input.patientId), input.vaccineGroup);
  const requests: BatchInputRequest<Immunization>[] = [
    ...(active
      ? [
          {
            method: 'PUT' as const,
            url: `/Immunization/${active.id}`,
            resource: clearImmunizationMark(active, recorder),
          },
        ]
      : []),
    {
      method: 'POST',
      url: '/Immunization',
      resource: buildImmunizationMark(input, createReference(patient), recorder),
    },
  ];
  const result = await oystehr.fhir.transaction<Immunization>({ requests });
  const created = result.entry?.map((entry) => entry.resource).find((resource) => resource?.id !== active?.id);
  if (!created?.id) throw new Error('The mark was not created');
  return { markId: created.id };
}

export function validateRequestParameters(
  input: ZambdaInput
): SaveImmunizationMarkRequest & Pick<ZambdaInput, 'secrets'> {
  return { ...validateImmunizationMarkInput(validateJsonBody(input)), secrets: input.secrets };
}

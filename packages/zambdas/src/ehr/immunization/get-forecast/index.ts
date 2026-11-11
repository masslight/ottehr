import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { cvxToGroups } from 'utils/lib/immunization-forecast/cvx-groups';
import {
  GetImmunizationForecastRequest,
  GetImmunizationForecastResponse,
} from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { assessmentDate, loadPatientForecast } from '../forecast';
import { assertImmunizationStaff, validateFhirId } from '../records';

let m2mToken: string;

const ZAMBDA_NAME = 'get-immunization-forecast';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  await assertImmunizationStaff(input, 'read immunization forecasts');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const response = await getImmunizationForecast(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/**
 * The engine run for the patient as of the visit's day (else the given day, else today), with the records it ran
 * on (the timeline) and the CVX → group map (the Due today box).
 */
export async function getImmunizationForecast(
  oystehr: Oystehr,
  input: GetImmunizationForecastRequest,
  now: DateTime = DateTime.now()
): Promise<GetImmunizationForecastResponse> {
  const encounter = input.encounterId
    ? await readPatientEncounter(oystehr, input.patientId, input.encounterId)
    : undefined;
  const asOf = encounter ? assessmentDate(encounter, now) : input.asOf ?? now.toISODate()!;
  const { patient, records, forecast } = await loadPatientForecast(oystehr, input.patientId, asOf);
  return { ...records, forecast, cvxGroups: cvxToGroups(), dob: patient.birthDate! };
}

async function readPatientEncounter(oystehr: Oystehr, patientId: string, encounterId: string): Promise<Encounter> {
  let encounter: Encounter;
  try {
    encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  } catch (error) {
    console.error('Failed to read the encounter to forecast for:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }
  if (getIdFromReference(encounter.subject?.reference, 'Patient') !== patientId) {
    throw INVALID_INPUT_ERROR('The encounter is not a visit of this patient');
  }
  return encounter;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateRequestParameters(
  input: ZambdaInput
): GetImmunizationForecastRequest & Pick<ZambdaInput, 'secrets'> {
  const { patientId, encounterId, asOf } = validateJsonBody(input);
  if (asOf !== undefined && asOf !== null && asOf !== '') {
    if (typeof asOf !== 'string' || !ISO_DATE.test(asOf) || !DateTime.fromISO(asOf).isValid) {
      throw INVALID_INPUT_ERROR(`Invalid asOf date, "${String(asOf)}" is not a yyyy-mm-dd date`);
    }
  }
  return {
    patientId: validateFhirId(patientId, 'patientId'),
    ...(encounterId != null && encounterId !== '' && { encounterId: validateFhirId(encounterId, 'encounterId') }),
    ...(asOf && { asOf }),
    secrets: input.secrets,
  };
}

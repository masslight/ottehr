import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getEncounterLocationId } from 'utils/lib/fhir/encounter';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { cvxToGroups } from 'utils/lib/immunization-forecast/cvx-groups';
import { projectLaterDoses } from 'utils/lib/immunization-forecast/projections';
import {
  GetImmunizationForecastRequest,
  GetImmunizationForecastResponse,
} from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
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
 * on (the timeline) and the CVX → group map (the Due today box). With a visit, dates are calendar days in its
 * location's time zone; without one, in the zone each record carries.
 */
export async function getImmunizationForecast(
  oystehr: Oystehr,
  input: GetImmunizationForecastRequest,
  now: DateTime = DateTime.now()
): Promise<GetImmunizationForecastResponse> {
  const encounter = input.encounterId
    ? await readPatientEncounter(oystehr, input.patientId, input.encounterId)
    : undefined;
  const timezone = encounter ? await readEncounterTimezone(oystehr, encounter) : undefined;
  const asOf = encounter
    ? assessmentDate(encounter, timezone ? now.setZone(timezone) : now, timezone)
    : input.asOf ?? now.toISODate()!;
  const {
    patient,
    records,
    forecast,
    input: forecastInput,
  } = await loadPatientForecast(oystehr, input.patientId, asOf, timezone);
  return {
    ...records,
    forecast,
    projections: projectLaterDoses(forecastInput, forecast),
    cvxGroups: cvxToGroups(),
    dob: patient.birthDate!,
  };
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

/** The visit location's time zone; none when the visit has no location (dates then keep their own offset). */
async function readEncounterTimezone(oystehr: Oystehr, encounter: Encounter): Promise<string | undefined> {
  const locationId = getEncounterLocationId(encounter);
  if (!locationId) return undefined;
  try {
    return getTimezone(await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }));
  } catch (error) {
    console.error('Failed to read the visit location for its time zone:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Location');
  }
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

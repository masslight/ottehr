import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { buildForecastInput } from 'utils/lib/immunization-forecast/forecast-input';
import {
  GetImmunizationForecastRequest,
  GetImmunizationForecastResponse,
} from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
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

/** The engine run server-side on the patient's records; the records come back with it for the timeline. */
export async function getImmunizationForecast(
  oystehr: Oystehr,
  input: GetImmunizationForecastRequest
): Promise<GetImmunizationForecastResponse> {
  let patient: Patient;
  try {
    patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: input.patientId });
  } catch (error) {
    console.error('Failed to read the patient to forecast:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!patient.birthDate) throw INVALID_INPUT_ERROR('The patient has no date of birth, so no forecast can be made');
  const records = buildPatientImmunizationsResponse(await searchPatientImmunizations(oystehr, input.patientId));
  const forecast = forecastImmunizations(
    buildForecastInput(
      { dob: patient.birthDate, sex: patient.gender, asOf: input.asOf ?? DateTime.now().toISODate()! },
      records.immunizations,
      records.marks
    )
  );
  return { ...records, forecast, dob: patient.birthDate };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateRequestParameters(
  input: ZambdaInput
): GetImmunizationForecastRequest & Pick<ZambdaInput, 'secrets'> {
  const { patientId, asOf } = validateJsonBody(input);
  if (asOf !== undefined && asOf !== null && asOf !== '') {
    if (typeof asOf !== 'string' || !ISO_DATE.test(asOf) || !DateTime.fromISO(asOf).isValid) {
      throw INVALID_INPUT_ERROR(`Invalid asOf date, "${String(asOf)}" is not a yyyy-mm-dd date`);
    }
  }
  return {
    patientId: validateFhirId(patientId, 'patientId'),
    ...(asOf && { asOf }),
    secrets: input.secrets,
  };
}

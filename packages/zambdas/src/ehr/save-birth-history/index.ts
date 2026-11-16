import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { BirthHistoryOutput, SaveBirthHistoryInputSchema } from 'utils/lib/types/api/birth-history.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import {
  fetchBirthHistoryObservation,
  makeBirthHistoryDTO,
  saveBirthHistoryObservation,
} from '../../shared/birth-history';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

const ZAMBDA_NAME = 'save-birth-history';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

// Birth history is saved once per patient: the save replaces the patient's one Observation, or creates it; a save with
// every field emptied deletes it.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // Authorization first, so an unauthenticated caller gets 401 whatever the body holds.
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, birthHistory, secrets } = validateWithSchema(SaveBirthHistoryInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const [patients, existing] = await Promise.all([
    oystehr.fhir.search<Patient>({ resourceType: 'Patient', params: [{ name: '_id', value: patientId }] }),
    fetchBirthHistoryObservation(oystehr, patientId),
  ]);
  if (patients.unbundle().length === 0) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const saved = await saveBirthHistoryObservation(oystehr, patientId, birthHistory, existing);
  const output: BirthHistoryOutput = { birthHistory: saved && makeBirthHistoryDTO(saved) };
  return { statusCode: 200, body: JSON.stringify(output) };
});

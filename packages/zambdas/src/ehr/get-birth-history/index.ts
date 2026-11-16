import { APIGatewayProxyResult } from 'aws-lambda';
import { BirthHistoryOutput, GetBirthHistoryInputSchema } from 'utils/lib/types/api/birth-history.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { fetchBirthHistoryObservation, makeBirthHistoryDTO } from '../../shared/birth-history';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

const ZAMBDA_NAME = 'get-birth-history';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // Authorization first, so an unauthenticated caller gets 401 whatever the body holds.
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, secrets } = validateWithSchema(GetBirthHistoryInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const observation = await fetchBirthHistoryObservation(oystehr, patientId);
  const output: BirthHistoryOutput = { birthHistory: observation && makeBirthHistoryDTO(observation) };
  return { statusCode: 200, body: JSON.stringify(output) };
});

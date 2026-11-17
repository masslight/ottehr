import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DeleteFreeFormEncounterInputSchema,
  DeleteFreeFormEncounterOutput,
} from 'utils/lib/types/api/free-form-encounter.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { deleteFreeFormEncounter } from './helpers';

const ZAMBDA_NAME = 'delete-free-form-encounter';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, encounterId, secrets } = validateWithSchema(DeleteFreeFormEncounterInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await deleteFreeFormEncounter(oystehr, encounterId, patientId);

  const output: DeleteFreeFormEncounterOutput = { encounterId };
  return lambdaResponse(200, output);
});

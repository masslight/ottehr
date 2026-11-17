import { APIGatewayProxyResult } from 'aws-lambda';
import {
  SaveFreeFormEncounterInputSchema,
  SaveFreeFormEncounterOutput,
} from 'utils/lib/types/api/free-form-encounter.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { freeFormEncounterHistoryRowFromEncounter } from '../shared/free-form-encounters';
import { createFreeFormEncounter, updateFreeFormEncounterNote } from './helpers';

const ZAMBDA_NAME = 'save-free-form-encounter';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, encounterId, note, secrets } = validateWithSchema(SaveFreeFormEncounterInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const saved = encounterId
    ? await updateFreeFormEncounterNote(oystehr, encounterId, patientId, note)
    : await createFreeFormEncounter(oystehr, patientId, note);

  const output: SaveFreeFormEncounterOutput | undefined = freeFormEncounterHistoryRowFromEncounter(saved);
  if (!output) throw new Error('The saved free-form encounter has no id');

  return lambdaResponse(200, output);
});

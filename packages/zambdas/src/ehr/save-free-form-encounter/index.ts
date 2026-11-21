import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ProviderDetails } from 'utils/lib/types/api/encounter.types';
import {
  SaveFreeFormEncounterInputSchema,
  SaveFreeFormEncounterOutput,
} from 'utils/lib/types/api/free-form-encounter.types';
import { checkOrCreateM2MClientToken, getUserToken } from '../../shared/auth';
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
    : await createFreeFormEncounter(oystehr, patientId, note, await getAuthor(getUserToken(input), secrets, oystehr));

  const output: SaveFreeFormEncounterOutput | undefined = freeFormEncounterHistoryRowFromEncounter(saved);
  if (!output) throw new Error('The saved free-form encounter has no id');

  return lambdaResponse(200, output);
});

/** Who is writing the note: the signed-in user from the token, never from the request body. */
async function getAuthor(
  userToken: string,
  secrets: ZambdaInput['secrets'],
  oystehr: Oystehr
): Promise<ProviderDetails> {
  const user = await userMe(userToken, secrets);
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!practitionerId) throw new Error('The signed-in user has no Practitioner profile');
  const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
  return { practitionerId, name: getFullestAvailableName(practitioner) ?? user.name };
}

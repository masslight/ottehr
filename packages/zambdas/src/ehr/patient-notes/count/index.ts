import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { GetPatientNotesCountOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-patient-notes-count';
let m2mToken: string;

const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Avoid _summary=count — Oystehr returns total: 1 even for 0 results when that flag is set.
  // Instead do a regular search: if entries are returned the status filter was applied correctly
  // and bundle.total holds the accurate cross-page total; if the array is empty there are no notes.
  const bundle = await oystehr.fhir.search<Communication>({
    resourceType: 'Communication',
    params: [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: '_tag', value: PATIENT_NOTE_TAG },
      { name: 'status', value: 'completed' },
    ],
  });

  const entries = bundle.unbundle();
  const count = entries.length > 0 ? bundle.total ?? entries.length : 0;
  const output: GetPatientNotesCountOutput = { count };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
});

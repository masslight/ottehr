import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { userMe } from 'utils/lib/auth/user-me.helper';
import {
  AMBIENT_SCRIBE_RECORDING_PENDING_CODING,
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  PUBLIC_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
import { getFormatDuration } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CreateResourcesFromAudioRecordingInput } from 'utils/lib/types/api/appointment.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { assertDefined, createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-resources-from-audio-recording';

export interface CreateResourcesFromAudioRecordingInputValidated extends CreateResourcesFromAudioRecordingInput {
  userToken: string;
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { userToken, z3URL, duration, visitID, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);

  const providerUserProfile = (await userMe(userToken, secrets)).profile;

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: visitID });
  const patientId = assertDefined(encounter.subject?.reference?.split('/')[1], 'patientId');

  const pendingDocumentReference: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: { coding: [AMBIENT_SCRIBE_RECORDING_PENDING_CODING] },
    category: [
      {
        coding: [
          {
            system: 'http://loinc.org',
            code: '34133-9',
            display: 'Summarization of episode note',
          },
        ],
      },
    ],
    description: DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
    subject: { reference: `Patient/${patientId}` },
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: z3URL,
          title: `Audio recording (${duration ? getFormatDuration(duration) : 'unknown'})`,
        },
      },
    ],
    context: {
      encounter: [{ reference: `Encounter/${visitID}` }],
    },
    extension: [
      {
        url: `${PUBLIC_EXTENSION_BASE_URL}/provider`,
        valueReference: { reference: providerUserProfile },
      },
    ],
  };

  const created = await oystehr.fhir.create<DocumentReference>(pendingDocumentReference);

  return {
    statusCode: 200,
    body: JSON.stringify(`Successfully created DocumentReference/${created.id}`),
  };
});

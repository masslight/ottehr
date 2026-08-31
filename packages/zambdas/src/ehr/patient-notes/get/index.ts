import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { GetPatientNotesOutput, PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-patient-notes';
let m2mToken: string;

const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const resources = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: '_tag', value: PATIENT_NOTE_TAG },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  const notes: PatientNoteDTO[] = resources.map((resource) => ({
    resourceId: resource.id,
    patientId: resource.subject?.reference?.split('/')[1] ?? '',
    text: resource.payload?.[0]?.contentString ?? '',
    authorId: resource.sender?.reference?.split('/')[1] ?? '',
    authorName: resource.sender?.display ?? '',
    lastUpdated: resource.meta?.lastUpdated ?? '',
    edited: isNoteEdited(resource.sent, resource.meta?.lastUpdated),
  }));

  const output: GetPatientNotesOutput = { notes };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
});

import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, fillMeta } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-patient-note';
let m2mToken: string;

const PATIENT_NOTE_ID = 'patient-note';
const PATIENT_NOTE_SYSTEM = 'patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { note, userToken, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const callerId = await getMyPractitionerId(userToken, secrets);
  const callerPractitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerId });
  const callerName = callerPractitioner.name?.[0]
    ? [callerPractitioner.name[0].given?.join(' '), callerPractitioner.name[0].family].filter(Boolean).join(' ')
    : '';

  const sent = new Date().toISOString();
  const resource: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    meta: fillMeta(PATIENT_NOTE_ID, PATIENT_NOTE_SYSTEM),
    subject: { reference: `Patient/${note.patientId}` },
    sender: { reference: `Practitioner/${callerId}`, display: callerName },
    sent,
    payload: [{ contentString: note.text }],
  };

  const saved = await oystehr.fhir.create<Communication>(resource);

  const output: SavePatientNoteOutput = {
    note: {
      resourceId: saved.id,
      patientId: note.patientId,
      text: saved.payload?.[0]?.contentString ?? '',
      authorId: callerId,
      authorName: callerName,
      lastUpdated: saved.meta?.lastUpdated ?? '',
      edited: isNoteEdited(sent, saved.meta?.lastUpdated),
    },
  };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
  };
});

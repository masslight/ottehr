import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, fillMeta } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-patient-note';
let m2mToken: string;

const PATIENT_NOTE_ID = 'patient-note';
const PATIENT_NOTE_SYSTEM = 'patient';
const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { note, userToken, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Resolve true caller identity from the token — never trust client-supplied authorId
  const callerId = await getMyPractitionerId(userToken, secrets);
  const callerPractitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerId });
  const callerName = callerPractitioner.name?.[0]
    ? [callerPractitioner.name[0].given?.join(' '), callerPractitioner.name[0].family].filter(Boolean).join(' ')
    : '';

  let existing: Communication | undefined;
  if (note.resourceId) {
    try {
      existing = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: note.resourceId });
    } catch (error) {
      if (!(error && typeof error === 'object' && (error as { code?: unknown }).code === 404)) {
        throw error;
      }
    }

    if (existing) {
      const hasPatientNoteTag = existing.meta?.tag?.some((tag) => `${tag.system}|${tag.code}` === PATIENT_NOTE_TAG);
      if (!hasPatientNoteTag) {
        throw new Error('Resource is not a patient note');
      }

      const notePatientId = existing.subject?.reference?.split('/')[1];
      if (notePatientId !== note.patientId) {
        throw new Error('Note does not belong to the specified patient');
      }

      const senderId = existing.sender?.reference?.split('/')[1];
      if (callerId !== senderId) {
        throw NOT_AUTHORIZED;
      }
    }
  }

  // Preserve the original sent timestamp on edits so isNoteEdited() detects drift between sent and meta.lastUpdated
  const sent = existing?.sent ?? new Date().toISOString();

  const resource: Communication = {
    ...(note.resourceId ? { id: note.resourceId } : {}),
    resourceType: 'Communication',
    status: 'completed',
    meta: fillMeta(PATIENT_NOTE_ID, PATIENT_NOTE_SYSTEM),
    subject: { reference: `Patient/${note.patientId}` },
    sender: {
      reference: `Practitioner/${callerId}`,
      display: callerName,
    },
    sent,
    payload: [{ contentString: note.text }],
  };

  let saved: Communication;
  if (note.resourceId && existing) {
    saved = await oystehr.fhir.update<Communication>(resource as Communication & { id: string });
  } else {
    saved = await oystehr.fhir.create<Communication>(resource);
  }

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

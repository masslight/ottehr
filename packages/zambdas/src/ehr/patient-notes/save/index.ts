import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, fillMeta } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-patient-note';
let m2mToken: string;

const PATIENT_NOTE_ID = 'patient-note';
const PATIENT_NOTE_SYSTEM = 'patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { note, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let existing: Communication | undefined;
  if (note.resourceId) {
    try {
      existing = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: note.resourceId });
    } catch {
      // Resource not found — create a new one
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
      reference: `Practitioner/${note.authorId}`,
      display: note.authorName,
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
      authorId: note.authorId,
      authorName: note.authorName,
      lastUpdated: saved.meta?.lastUpdated ?? '',
      edited: isNoteEdited(sent, saved.meta?.lastUpdated),
    },
  };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
});

import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Communication, Extension, Practitioner } from 'fhir/r4b';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { SaveNoteOutput, UpdateNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { FHIR_RESOURCE_NOT_FOUND, FHIR_RESOURCE_VALIDATION_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import {
  getNoteTaskId,
  getPractitionerName,
  isPatientOrTaskNote,
  isTaskNote,
  NOTE_EDITOR_EXTENSION_URL,
  toNoteDto,
} from '../../../shared/notes';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'update-patient-note';
let m2mToken: string;

const assertNoteEditable = (resource: Communication, note: UpdateNoteRequest): void => {
  if (!isPatientOrTaskNote(resource)) throw FHIR_RESOURCE_VALIDATION_ERROR('Resource is not a note');

  const belongs = note.taskId
    ? isTaskNote(resource) && getNoteTaskId(resource) === note.taskId
    : !isTaskNote(resource) && resource.subject?.reference?.split('/')[1] === note.patientId;
  if (!belongs) {
    throw FHIR_RESOURCE_VALIDATION_ERROR(`Note does not belong to the specified ${note.taskId ? 'task' : 'patient'}`);
  }

  if (resource.status !== 'completed')
    throw FHIR_RESOURCE_VALIDATION_ERROR('Note has been deleted and cannot be updated');
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { note, userToken, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let existing: Communication;
  try {
    existing = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: note.resourceId });
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 404) {
      throw FHIR_RESOURCE_NOT_FOUND('Communication');
    }
    throw error;
  }

  assertNoteEditable(existing, note);

  const callerId = await getMyPractitionerId(userToken, secrets);
  const callerPractitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerId });
  const editor: Extension = {
    url: NOTE_EDITOR_EXTENSION_URL,
    valueReference: { reference: `Practitioner/${callerId}`, display: getPractitionerName(callerPractitioner) },
  };
  let current = existing;
  const saved = await withVersionConflictRetries(async (attempt) => {
    if (attempt > 1) {
      current = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: note.resourceId });
      assertNoteEditable(current, note);
    }
    const operations: Operation[] = [{ op: 'replace', path: '/payload', value: [{ contentString: note.text }] }];
    const isNewEditor = !current.extension?.some(
      (ext) =>
        ext.url === NOTE_EDITOR_EXTENSION_URL && ext.valueReference?.reference === editor.valueReference?.reference
    );
    if (isNewEditor) {
      operations.push(
        current.extension
          ? { op: 'add', path: '/extension/-', value: editor }
          : { op: 'add', path: '/extension', value: [editor] }
      );
    }
    return oystehr.fhir.patch<Communication>(
      { resourceType: 'Communication', id: note.resourceId, operations },
      { optimisticLockingVersionId: current.meta?.versionId }
    );
  });

  const output: SaveNoteOutput = { note: toNoteDto(saved, callerId) };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
  };
});

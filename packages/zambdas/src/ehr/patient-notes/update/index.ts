import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { FHIR_RESOURCE_NOT_FOUND, FHIR_RESOURCE_VALIDATION_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import {
  getNoteTaskId,
  getPractitionerName,
  isPatientOrTaskNote,
  isTaskNote,
  toNoteDto,
  withEditor,
} from '../../../shared/notes';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'update-patient-note';
let m2mToken: string;

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

  if (!isPatientOrTaskNote(existing)) throw FHIR_RESOURCE_VALIDATION_ERROR('Resource is not a patient note');

  const belongs = note.taskId
    ? isTaskNote(existing) && getNoteTaskId(existing) === note.taskId
    : !isTaskNote(existing) && existing.subject?.reference?.split('/')[1] === note.patientId;
  if (!belongs) {
    throw FHIR_RESOURCE_VALIDATION_ERROR(`Note does not belong to the specified ${note.taskId ? 'task' : 'patient'}`);
  }

  if (existing.status !== 'completed')
    throw FHIR_RESOURCE_VALIDATION_ERROR('Note has been deleted and cannot be updated');

  const callerId = await getMyPractitionerId(userToken, secrets);

  const callerPractitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerId });

  // A patch, not a whole-resource update: the author, sent time and tags (read markers, the notified marker) that
  // others may write meanwhile all stay as they are.
  const editors = withEditor(existing, callerId, getPractitionerName(callerPractitioner));
  // Appended to an existing list, so two first-time editors at once both stay listed.
  const addEditor =
    editors === existing.extension
      ? []
      : existing.extension
      ? [{ op: 'add' as const, path: '/extension/-', value: editors[editors.length - 1] }]
      : [{ op: 'add' as const, path: '/extension', value: editors }];
  const saved = await oystehr.fhir.patch<Communication>({
    resourceType: 'Communication',
    id: note.resourceId,
    operations: [{ op: 'replace', path: '/payload', value: [{ contentString: note.text }] }, ...addEditor],
  });

  const output: SavePatientNoteOutput = { note: toNoteDto(saved, callerId) };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
  };
});

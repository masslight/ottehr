import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, fillMeta } from '../../../shared/helpers';
import { getPractitionerName, toNoteDto } from '../../../shared/notes';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-patient-note';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { note, userToken, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const callerId = await getMyPractitionerId(userToken, secrets);
  const callerPractitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerId });

  const resource: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    ...(note.taskId
      ? { meta: fillMeta('task-note', 'task'), basedOn: [{ reference: `Task/${note.taskId}` }] }
      : { meta: fillMeta('patient-note', 'patient'), subject: { reference: `Patient/${note.patientId}` } }),
    sender: { reference: `Practitioner/${callerId}`, display: getPractitionerName(callerPractitioner) },
    sent: new Date().toISOString(),
    payload: [{ contentString: note.text }],
  };

  const saved = await oystehr.fhir.create<Communication>(resource);

  const output: SavePatientNoteOutput = { note: toNoteDto(saved, callerId) };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
  };
});

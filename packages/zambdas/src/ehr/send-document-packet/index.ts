import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  DOCUMENT_PACKET_REQUEST_TASK_INPUT,
  DocumentPacketSource,
  DocumentPacketTaskPayload,
  SendDocumentPacketOutput,
} from 'utils/lib/types/api/document-packet.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-document-packet';

let m2mToken: string;

/**
 * Queues an outbound fax: validates the request, resolves the patient, and creates a `send-document-packet` Task.
 * The heavy work (build the packet, send to each recipient) runs asynchronously in `sub-send-document-packet`,
 * so this returns immediately with the Task id, which the caller polls via `get-document-packet-status`.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);
  const { source, recipients, secrets } = validatedInput;
  console.log(`send-document-packet queue: source=${source.type} recipients=${recipients.length}`);

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  const senderPractitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!senderPractitionerId) throw new Error('User practitioner reference is invalid');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // The Task is the unit of work the subscription picks up, so it has to name the patient it is for.
  // A single-visit packet also names the visit, which is what files it under that visit's fax history.
  const { patientId, appointmentId } = await resolveTaskSubject(oystehr, source);

  const payload: DocumentPacketTaskPayload = { source, recipients, senderPractitionerId, senderUserId: user.id };

  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: {
      coding: [{ system: TaskIndicator.sendDocumentPacket.system, code: TaskIndicator.sendDocumentPacket.code }],
    },
    ...(appointmentId ? { focus: { reference: `Appointment/${appointmentId}`, type: 'Appointment' } } : {}),
    for: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    input: [
      {
        type: { coding: [DOCUMENT_PACKET_REQUEST_TASK_INPUT] },
        valueString: JSON.stringify(payload),
      },
    ],
  });

  const output: SendDocumentPacketOutput = { taskId: task.id! };
  return { statusCode: 200, body: JSON.stringify(output) };
});

const resolveTaskSubject = async (
  oystehr: Oystehr,
  source: DocumentPacketSource
): Promise<{ patientId: string; appointmentId?: string }> => {
  if (source.type !== 'visit') {
    return { patientId: source.patientId, appointmentId: undefined };
  }

  const visitResources = await getAppointmentAndRelatedResources(oystehr, source.appointmentId, true);
  if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(
      `Visit resources could not be resolved for appointment ${source.appointmentId}`
    );
  }
  return { patientId: visitResources.patient.id, appointmentId: visitResources.appointment.id };
};

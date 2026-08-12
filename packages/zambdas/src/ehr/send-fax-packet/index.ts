import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import {
  FAX_PACKET_REQUEST_TASK_INPUT,
  FaxPacketTaskPayload,
  SendFaxPacketOutput,
} from 'utils/lib/types/api/fax.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-fax-packet';

let m2mToken: string;

/**
 * Queues an outbound fax: validates the request, resolves the patient, and creates a `send-fax-packet` Task.
 * The heavy work (build the packet, send to each recipient) runs asynchronously in `sub-send-fax-packet`,
 * so this returns immediately with the Task id, which the caller polls via `get-fax-packet-status`.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);
  const { appointmentId, recipients, secrets } = validatedInput;
  console.log(`send-fax-packet queue: appointment=${appointmentId} recipients=${recipients.length}`);

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  const senderPractitionerId = removePrefix('Practitioner/', user.profile);
  if (!senderPractitionerId) throw new Error('User practitioner reference is invalid');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit resources could not be resolved for appointment ${appointmentId}`);
  }

  const payload: FaxPacketTaskPayload = { recipients, senderPractitionerId, senderUserId: user.id };

  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: TaskIndicator.sendFaxPacket.system, code: TaskIndicator.sendFaxPacket.code }] },
    focus: { reference: `Appointment/${visitResources.appointment.id}`, type: 'Appointment' },
    for: { reference: `Patient/${visitResources.patient.id}` },
    authoredOn: new Date().toISOString(),
    input: [
      {
        type: { coding: [FAX_PACKET_REQUEST_TASK_INPUT] },
        valueString: JSON.stringify(payload),
      },
    ],
  });

  const output: SendFaxPacketOutput = { taskId: task.id! };
  return { statusCode: 200, body: JSON.stringify(output) };
});

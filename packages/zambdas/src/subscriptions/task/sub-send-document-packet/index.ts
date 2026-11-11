import Oystehr from '@oystehr/sdk';
import { Organization, Practitioner, Task } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  DOCUMENT_PACKET_FAILURE_TASK_OUTPUT,
  DOCUMENT_PACKET_REQUEST_TASK_INPUT,
  DOCUMENT_PACKET_RESULTS_TASK_OUTPUT,
  DocumentPacketJobFailureReason,
  DocumentPacketSource,
  DocumentPacketTaskPayload,
} from 'utils/lib/types/api/document-packet.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { DocumentPacketTooLargeError } from '../../../shared/document-packet/build-document-packet';
import { deliverDocumentPacket, savePcpIfRequested } from '../../../shared/document-packet/deliver-document-packet';
import { resolveDocumentPacketPlan } from '../../../shared/document-packet/resolve-packet-source';
import { wrapTaskHandler } from '../helpers';

let cachedM2MToken: string | undefined;

const ensureM2MToken = async (secrets: Secrets | null): Promise<string> => {
  cachedM2MToken = await checkOrCreateM2MClientToken(cachedM2MToken ?? '', secrets);
  return cachedM2MToken;
};

const readPayload = (task: Task): DocumentPacketTaskPayload => {
  const raw = task.input?.find(
    (entry) =>
      entry.type?.coding?.some(
        (coding) =>
          coding.system === DOCUMENT_PACKET_REQUEST_TASK_INPUT.system &&
          coding.code === DOCUMENT_PACKET_REQUEST_TASK_INPUT.code
      )
  )?.valueString;

  if (!raw) throw new Error('Document packet task is missing its request payload');

  return JSON.parse(raw) as DocumentPacketTaskPayload;
};

/** Tasks queued before the payload carried a source are single-visit sends named by `Task.focus`. */
const packetSourceFromTaskFocus = (task: Task): DocumentPacketSource => {
  const appointmentId = getIdFromReference(task.focus?.reference, 'Appointment');
  if (!appointmentId) throw new Error('Document packet task has neither a source nor an Appointment focus');
  return { type: 'visit', appointmentId };
};

const recordFailureReason = async (
  oystehr: Oystehr,
  taskId: string,
  reason: DocumentPacketJobFailureReason
): Promise<void> => {
  try {
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: taskId,
      operations: [
        {
          op: 'add',
          path: '/output',
          value: [{ type: { coding: [DOCUMENT_PACKET_FAILURE_TASK_OUTPUT] }, valueString: reason }],
        },
      ],
    });
  } catch (error) {
    console.error('Error recording document packet failure reason:', error);
  }
};

export const index = wrapTaskHandler(
  'sub-send-document-packet',
  async (input, oystehr) => {
    const { task, secrets } = input;

    try {
      const payload = readPayload(task);
      const source = payload.source ?? packetSourceFromTaskFocus(task);
      const token = await ensureM2MToken(secrets);
      const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

      const [plan, organization, senderPractitioner] = await Promise.all([
        resolveDocumentPacketPlan({ oystehr, token, secrets, source }),
        oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
        oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: payload.senderPractitionerId }),
      ]);

      const results = await deliverDocumentPacket({
        oystehr,
        token,
        secrets,
        plan,
        organization,
        senderPractitioner,
        senderUserId: payload.senderUserId,
        organizationId,
        recipients: payload.recipients,
      });

      await savePcpIfRequested(payload.recipients, plan.patient, oystehr);

      // Per-recipient outcomes for the status poll. Written before wrapTaskHandler marks the task completed;
      // patchTaskStatus only touches /status + /statusReason, so this output survives.
      await oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          {
            op: 'add',
            path: '/output',
            value: [{ type: { coding: [DOCUMENT_PACKET_RESULTS_TASK_OUTPUT] }, valueString: JSON.stringify(results) }],
          },
        ],
      });

      const sent = results.filter((result) => result.status === 'sent').length;

      return {
        taskStatus: 'completed' as const,
        statusReason: `document packet sent to ${sent}/${results.length} recipient(s)`,
      };
    } catch (error) {
      if (!(error instanceof DocumentPacketTooLargeError)) throw error;
      console.log(`[document-packet] ${error.message}`);
      await recordFailureReason(oystehr, task.id!, 'too-large');
      return { taskStatus: 'failed' as const, statusReason: error.message };
    }
  },
  { retry: false }
);

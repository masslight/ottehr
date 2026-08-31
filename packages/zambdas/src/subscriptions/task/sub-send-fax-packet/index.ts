import { Organization, Practitioner, Task } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  FAX_PACKET_REQUEST_TASK_INPUT,
  FAX_PACKET_RESULTS_TASK_OUTPUT,
  FaxPacketSource,
  FaxPacketTaskPayload,
} from 'utils/lib/types/api/fax.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { resolveFaxPacketPlan } from '../../../shared/fax/resolve-fax-source';
import { deliverFaxPacket, savePcpIfRequested } from '../../../shared/fax/run-fax-packet';
import { wrapTaskHandler } from '../helpers';

let cachedM2MToken: string | undefined;

const ensureM2MToken = async (secrets: Secrets | null): Promise<string> => {
  cachedM2MToken = await checkOrCreateM2MClientToken(cachedM2MToken ?? '', secrets);
  return cachedM2MToken;
};

const readPayload = (task: Task): FaxPacketTaskPayload => {
  const raw = task.input?.find(
    (entry) =>
      entry.type?.coding?.some(
        (coding) =>
          coding.system === FAX_PACKET_REQUEST_TASK_INPUT.system && coding.code === FAX_PACKET_REQUEST_TASK_INPUT.code
      )
  )?.valueString;

  if (!raw) throw new Error('Fax packet task is missing its request payload');

  return JSON.parse(raw) as FaxPacketTaskPayload;
};

/** Tasks queued before the payload carried a source are single-visit sends named by `Task.focus`. */
const faxSourceFromTaskFocus = (task: Task): FaxPacketSource => {
  const appointmentId = removePrefix('Appointment/', task.focus?.reference ?? '');
  if (!appointmentId) throw new Error('Fax packet task has neither a source nor an Appointment focus');
  return { type: 'visit', appointmentId };
};

export const index = wrapTaskHandler(
  'sub-send-fax-packet',
  async (input, oystehr) => {
    const { task, secrets } = input;

    const payload = readPayload(task);
    const source = payload.source ?? faxSourceFromTaskFocus(task);
    const token = await ensureM2MToken(secrets);
    const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

    const [plan, organization, senderPractitioner] = await Promise.all([
      resolveFaxPacketPlan({ oystehr, token, secrets, source }),
      oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: payload.senderPractitionerId }),
    ]);

    const results = await deliverFaxPacket({
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
          value: [{ type: { coding: [FAX_PACKET_RESULTS_TASK_OUTPUT] }, valueString: JSON.stringify(results) }],
        },
      ],
    });

    const sent = results.filter((result) => result.status === 'sent').length;

    return {
      taskStatus: 'completed' as const,
      statusReason: `fax packet sent to ${sent}/${results.length} recipient(s)`,
    };
  },
  { retry: false }
);

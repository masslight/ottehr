import { Organization, Practitioner, Task } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  FAX_PACKET_REQUEST_TASK_INPUT,
  FAX_PACKET_RESULTS_TASK_OUTPUT,
  FaxPacketTaskPayload,
} from 'utils/lib/types/api/fax.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { deliverFaxPacket, savePcpIfRequested } from '../../../shared/fax/run-fax-packet';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
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

export const index = wrapTaskHandler(
  'sub-send-fax-packet',
  async (input, oystehr) => {
    const { task, secrets } = input;

    const appointmentId = removePrefix('Appointment/', task.focus?.reference ?? '');
    if (!appointmentId) throw new Error('Fax packet task focus is not an Appointment');

    const payload = readPayload(task);
    const token = await ensureM2MToken(secrets);
    const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

    const [visitResources, organization, senderPractitioner] = await Promise.all([
      getAppointmentAndRelatedResources(oystehr, appointmentId, true),
      oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: payload.senderPractitionerId }),
    ]);

    if (!visitResources?.appointment?.id || !visitResources.patient?.id) {
      throw new Error(`Visit resources could not be resolved for appointment ${appointmentId}`);
    }

    const patient = visitResources.patient;

    const results = await deliverFaxPacket({
      oystehr,
      token,
      secrets,
      visitResources,
      patient,
      organization,
      senderPractitioner,
      senderUserId: payload.senderUserId,
      organizationId,
      recipients: payload.recipients,
    });

    await savePcpIfRequested(payload.recipients, patient, oystehr);

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

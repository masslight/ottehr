import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, DocumentReference, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ACTION_LOG_VIEWER_ROLES,
  DATETIME_FULL_NO_YEAR,
  getAddressStringForScheduleResource,
  getOutboundDeliveryAttemptStatus,
  getOutboundDeliveryChannel,
  getOutboundDeliveryRecipientSnapshot,
  getPresignedURL,
  getReferenceId,
  getSecret,
  InPersonCompletionTemplateData,
  OTTEHR_MODULE,
  RetryActionLogOutput,
  SecretsKeys,
  TelemedCompletionTemplateData,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  makeAddressUrl,
  requireUserWithRole,
  sendFaxAttempt,
  SendFaxAttemptInput,
  sendVisitNoteEmailAttempt,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { getNameForOwner } from '../schedules/shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'retry-action-log';
let m2mToken = '';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  await requireUserWithRole(userToken, parameters.secrets, ACTION_LOG_VIEWER_ROLES);
  const user = await getUser(userToken, parameters.secrets);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);

  const original = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: parameters.attemptId });
  const channel = getOutboundDeliveryChannel(original);
  if (!channel) throw new Error('Task is not an outbound delivery attempt');
  if (!(await isRetryable(original, channel, oystehr))) throw new Error('Only failed delivery attempts can be retried');

  const patientId = requiredString(getReferenceId(original.for?.reference, 'Patient'), 'patient reference');
  const appointmentId = requiredString(
    getReferenceId(original.focus?.reference, 'Appointment'),
    'appointment reference'
  );
  const recipient = getOutboundDeliveryRecipientSnapshot(original);
  const recipientAddress = requiredString(recipient.address, 'recipient address');
  const recipientName = recipient.name;
  const documentReference = await resolveDocumentReference(original, appointmentId, oystehr);
  const documentReferenceId = requiredString(documentReference.id, 'DocumentReference id');
  const media = requiredString(documentReference.content[0]?.attachment.url, 'document URL');

  let retried: Task;
  if (channel === 'fax') {
    const userPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: user.profile.split('/')[1],
    });
    const faxInput: SendFaxAttemptInput = {
      appointmentId,
      faxNumber: recipientAddress,
      organizationId: getSecret(SecretsKeys.ORGANIZATION_ID, parameters.secrets),
      patientId,
      media: await getPresignedURL(media, m2mToken),
      documentReferenceId,
      userPractitioner,
      recipientName,
      parentAttemptId: original.id,
      senderId: user.id,
    };
    retried = await sendFaxAttempt(faxInput, oystehr);
  } else {
    const visit = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visit?.patient || !visit.location) throw new Error('Visit resources are incomplete');
    const visitNoteUrl = await getPresignedURL(media, m2mToken);
    const locationName = getNameForOwner(visit.location);
    const isInPerson = Boolean(visit.appointment.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.IP));
    if (isInPerson) {
      const address = requiredString(getAddressStringForScheduleResource(visit.location), 'location address');
      const prettyStartTime = requiredString(
        visit.appointment.start && visit.timezone
          ? DateTime.fromISO(visit.appointment.start).setZone(visit.timezone).toFormat(DATETIME_FULL_NO_YEAR)
          : undefined,
        'appointment time'
      );
      const templateData: InPersonCompletionTemplateData = {
        location: locationName,
        time: prettyStartTime,
        address,
        'address-url': makeAddressUrl(address),
        'visit-note-url': visitNoteUrl,
      };
      retried = await sendVisitNoteEmailAttempt({
        mode: 'in-person',
        oystehr,
        secrets: parameters.secrets,
        patientId,
        appointmentId,
        recipientEmail: recipientAddress,
        recipientName,
        documentReferenceId,
        parentAttemptId: original.id,
        templateData,
      });
    } else {
      const templateData: TelemedCompletionTemplateData = {
        location: locationName,
        'visit-note-url': visitNoteUrl,
      };
      retried = await sendVisitNoteEmailAttempt({
        mode: 'virtual',
        oystehr,
        secrets: parameters.secrets,
        patientId,
        appointmentId,
        recipientEmail: recipientAddress,
        recipientName,
        documentReferenceId,
        parentAttemptId: original.id,
        templateData,
      });
    }
  }
  if (!retried.id) throw new Error('Retry attempt was created without an id');
  const output: RetryActionLogOutput = { attemptId: retried.id };
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function isRetryable(task: Task, channel: 'fax' | 'email', oystehr: Oystehr): Promise<boolean> {
  if (channel === 'email') return task.status === 'failed';
  const communicationId = getOutboundDeliveryRecipientSnapshot(task).communicationId;
  if (!communicationId) return task.status === 'failed';
  const communication = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: communicationId });
  return getOutboundDeliveryAttemptStatus(task, communication) === 'failed';
}

function requiredString(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is missing from the attempt`);
  return value;
}

export async function resolveDocumentReference(
  task: Task,
  appointmentId: string,
  oystehr: Oystehr
): Promise<DocumentReference> {
  const storedReference = getOutboundDeliveryRecipientSnapshot(task).documentReferenceId;
  if (storedReference) {
    return oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: storedReference,
    });
  }

  const resources = (
    await oystehr.fhir.search<Appointment | DocumentReference>({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: appointmentId },
        { name: '_revinclude', value: 'DocumentReference:related' },
      ],
    })
  ).unbundle();
  const documentReference = resources.find(
    (resource): resource is DocumentReference =>
      resource.resourceType === 'DocumentReference' &&
      Boolean(resource.type?.coding?.some((coding) => coding.code === VISIT_NOTE_SUMMARY_CODE))
  );
  if (!documentReference) throw new Error('Visit note DocumentReference is missing from the appointment');
  return documentReference;
}

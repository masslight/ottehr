import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, DocumentReference, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  FEATURE_FLAGS_CONFIG,
  getAddressStringForScheduleResource,
  getFullestAvailableName,
  getOutboundDeliveryAttemptStatus,
  getOutboundDeliveryChannel,
  getOutboundDeliveryRecipientSnapshot,
  getPresignedURL,
  getSecret,
  makeOutboundDeliveryAttempt,
  OTTEHR_MODULE,
  OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM,
  PATIENT_ACTION_LOG_VIEWER_ROLES,
  removePrefix,
  RetryActionLogInputValidated,
  RetryActionLogOutput,
  SecretsKeys,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import {
  buildVisitNoteEmailTemplate,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  createOutboundDeliveryAttemptIdempotently,
  deliverFaxAttempt,
  deliverVisitNoteEmailAttempt,
  getEmailClient,
  requireOutboundDeliveryValue,
  requireUserWithRole,
  SendFaxAttemptInput,
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
  const user = await requireUserWithRole(userToken, parameters.secrets, PATIENT_ACTION_LOG_VIEWER_ROLES);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);

  const output = await performEffect(parameters, oystehr, user, m2mToken);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  parameters: RetryActionLogInputValidated,
  oystehr: Oystehr,
  user: User,
  accessToken: string
): Promise<RetryActionLogOutput> {
  const original = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: parameters.attemptId });
  const channel = getOutboundDeliveryChannel(original);
  if (!channel) throw new Error('Task is not an outbound delivery attempt');
  if (!(await isRetryable(original, channel, oystehr))) throw new Error('Only failed delivery attempts can be retried');
  if (await hasRetryChild(parameters.attemptId, oystehr)) {
    throw new Error('This delivery attempt has already been retried');
  }

  const emailClient = channel === 'email' ? getEmailClient(parameters.secrets, oystehr) : undefined;
  if (channel === 'email') {
    if (FEATURE_FLAGS_CONFIG.skipSendingVisitNoteToPatientPortalEnabled) {
      throw new Error('Visit note email delivery is disabled while the patient portal feature flag is on');
    }
    if (!emailClient?.getFeatureFlag()) throw new Error('Visit note email delivery is disabled');
  }

  const originalId = requireOutboundDeliveryValue(original.id, 'attempt id');
  const patientId = requireOutboundDeliveryValue(
    removePrefix('Patient/', original.for?.reference ?? ''),
    'patient reference'
  );
  const appointmentId = requireOutboundDeliveryValue(
    removePrefix('Appointment/', original.focus?.reference ?? ''),
    'appointment reference'
  );
  const recipient = getOutboundDeliveryRecipientSnapshot(original);
  const recipientAddress = requireOutboundDeliveryValue(recipient.address, 'recipient address');
  const recipientName = recipient.name;
  const documentReference = await resolveDocumentReference(original, appointmentId, oystehr);
  const documentReferenceId = requireOutboundDeliveryValue(documentReference.id, 'DocumentReference id');
  const media = requireOutboundDeliveryValue(documentReference.content[0]?.attachment.url, 'document URL');
  const userPractitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: requireOutboundDeliveryValue(removePrefix('Practitioner/', user.profile), 'user practitioner reference'),
  });
  const requesterReference = userPractitioner.id ? `Practitioner/${userPractitioner.id}` : undefined;
  const senderDisplay = getFullestAvailableName(userPractitioner);

  let retried: Task;
  if (channel === 'fax') {
    const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, parameters.secrets);
    const faxInput: SendFaxAttemptInput = {
      appointmentId,
      faxNumber: recipientAddress,
      organizationId,
      patientId,
      media: await getPresignedURL(media, accessToken),
      documentReferenceId,
      userPractitioner,
      recipientName,
      parentAttemptId: originalId,
      senderId: user.id,
    };
    const claim = await createOutboundDeliveryAttemptIdempotently(
      oystehr,
      makeOutboundDeliveryAttempt({
        channel,
        patientId,
        appointmentId,
        recipientAddress,
        recipientName,
        documentReferenceId,
        requesterReference,
        senderOrganizationReference: `Organization/${organizationId}`,
        parentAttemptId: originalId,
        senderId: user.id,
        senderDisplay,
      }),
      { system: OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM, value: `Task/${originalId}` }
    );
    if (claim.status === 'existing') throw new Error('This delivery attempt has already been retried');
    retried = await deliverFaxAttempt(faxInput, oystehr, claim.attempt);
  } else {
    if (!emailClient) throw new Error('Visit note email client was not initialized');
    const visit = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visit?.patient || !visit.location) throw new Error('Visit resources are incomplete');
    const visitNoteUrl = await getPresignedURL(media, accessToken);
    const locationName = getNameForOwner(visit.location);
    const isInPerson = Boolean(visit.appointment.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.IP));
    const emailTemplate = buildVisitNoteEmailTemplate({
      isInPerson,
      locationName,
      visitNoteUrl,
      address: getAddressStringForScheduleResource(visit.location),
      prettyStartTime:
        visit.appointment.start && visit.timezone
          ? DateTime.fromISO(visit.appointment.start).setZone(visit.timezone).toFormat(DATETIME_FULL_NO_YEAR)
          : undefined,
    });
    const emailInput = {
      ...emailTemplate,
      oystehr,
      secrets: parameters.secrets,
      patientId,
      appointmentId,
      recipientEmail: recipientAddress,
      recipientName,
      documentReferenceId,
      parentAttemptId: originalId,
      requesterReference,
      senderId: user.id,
      senderDisplay,
    };
    const claim = await createOutboundDeliveryAttemptIdempotently(
      oystehr,
      makeOutboundDeliveryAttempt({
        channel,
        patientId,
        appointmentId,
        recipientAddress,
        recipientName,
        documentReferenceId,
        requesterReference,
        parentAttemptId: originalId,
        senderId: user.id,
        senderDisplay,
      }),
      { system: OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM, value: `Task/${originalId}` }
    );
    if (claim.status === 'existing') throw new Error('This delivery attempt has already been retried');
    retried = await deliverVisitNoteEmailAttempt(emailInput, claim.attempt, emailClient);
  }
  if (!retried.id) throw new Error('Retry attempt was created without an id');
  return { attemptId: retried.id };
}

export async function hasRetryChild(attemptId: string, oystehr: Oystehr): Promise<boolean> {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'part-of', value: `Task/${attemptId}` },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle().some((resource) => resource.resourceType === 'Task');
}

export async function isRetryable(task: Task, channel: 'fax' | 'email', oystehr: Oystehr): Promise<boolean> {
  if (channel === 'email') return task.status === 'failed';
  const communicationId = getOutboundDeliveryRecipientSnapshot(task).communicationId;
  if (!communicationId) return task.status === 'failed';
  const communication = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: communicationId });
  return getOutboundDeliveryAttemptStatus(task, communication) === 'failed';
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

import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, DocumentReference, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { OUTBOUND_DELIVERY_INPUT_CODES, OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/constants';
import { getAddressStringForScheduleResource } from 'utils/lib/fhir/helpers';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import {
  getOutboundDeliveryAttemptStatus,
  getOutboundDeliveryChannel,
  getOutboundDeliveryInput,
  getOutboundDeliveryPacketSnapshot,
  getOutboundDeliveryRecipientSnapshot,
  isDocumentLinkAttempt,
  makeOutboundDeliveryAttempt,
} from 'utils/lib/fhir/outbound-delivery';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { isReferralServiceRequest } from 'utils/lib/fhir/referral';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  PATIENT_ACTION_LOG_VIEWER_ROLES,
  RetryActionLogInputValidated,
  RetryActionLogOutput,
} from 'utils/lib/types/api/action-logs.types';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { DATETIME_FULL_NO_YEAR } from 'utils/lib/validation/constants';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../shared/auth';
import { getEmailClient } from '../../shared/communication';
import { assertReferralFaxable } from '../../shared/document-packet/resolve-packet-source';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  createOutboundDeliveryAttemptIdempotently,
  requireOutboundDeliveryValue,
} from '../../shared/outbound-delivery';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { markReferralSent } from '../../shared/referrals/mark-referral-sent';
import { deliverFaxAttempt, SendFaxAttemptInput } from '../../shared/send-fax-attempt';
import { wrapHandler } from '../../shared/sentry';
import { settledValueOrThrow } from '../../shared/settled';
import { ZambdaInput } from '../../shared/types/common';
import { buildVisitNoteEmailTemplate, deliverVisitNoteEmailAttempt } from '../../shared/visit-note-email';
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
  const [originalResult, retryChildExistsResult] = await Promise.allSettled([
    oystehr.fhir.get<Task>({ resourceType: 'Task', id: parameters.attemptId }),
    hasRetryChild(parameters.attemptId, oystehr),
  ]);
  const original = settledValueOrThrow(originalResult);
  const channel = getOutboundDeliveryChannel(original);
  if (!channel) throw new Error('Task is not an outbound delivery attempt');
  if (!(await isRetryable(original, channel, oystehr))) throw new Error('Only failed delivery attempts can be retried');
  if (settledValueOrThrow(retryChildExistsResult)) {
    throw new Error('This delivery attempt has already been retried');
  }
  if (channel === 'fax') await assertBasedOnReferralFaxable(original, oystehr);

  const emailClient = channel === 'email' ? getEmailClient(parameters.secrets, oystehr) : undefined;
  if (channel === 'email') {
    if (FEATURE_FLAGS_CONFIG.skipSendingVisitNoteToPatientPortalEnabled) {
      throw new Error('Visit note email delivery is disabled while the patient portal feature flag is on');
    }
    if (!emailClient?.getFeatureFlag()) throw new Error('Visit note email delivery is disabled');
  }

  const originalId = requireOutboundDeliveryValue(original.id, 'attempt id');
  const patientId = requireOutboundDeliveryValue(
    getIdFromReference(original.for?.reference, 'Patient'),
    'patient reference'
  );
  const appointmentId = getIdFromReference(original.focus?.reference, 'Appointment');
  const recipient = getOutboundDeliveryRecipientSnapshot(original);
  const packetSnapshot = getOutboundDeliveryPacketSnapshot(original);
  const recipientAddress = requireOutboundDeliveryValue(recipient.address, 'recipient address');
  const recipientName = recipient.name;
  const [documentReferenceResult, userPractitionerResult] = await Promise.allSettled([
    resolveDocumentReference(original, appointmentId, oystehr),
    (async () =>
      oystehr.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: requireOutboundDeliveryValue(
          getIdFromReference(user.profile, 'Practitioner'),
          'user practitioner reference'
        ),
      }))(),
  ]);
  const documentReference = settledValueOrThrow(documentReferenceResult);
  const documentReferenceId = requireOutboundDeliveryValue(documentReference.id, 'DocumentReference id');
  const media = requireOutboundDeliveryValue(documentReference.content[0]?.attachment.url, 'document URL');
  const userPractitioner = settledValueOrThrow(userPractitionerResult);
  const requesterReference = userPractitioner.id ? `Practitioner/${userPractitioner.id}` : undefined;
  const senderDisplay = getFullestAvailableName(userPractitioner);

  let retried: Task;
  if (channel === 'fax') {
    const basedOnReference = original.basedOn?.[0]?.reference;
    const basedOnVersionId = getOutboundDeliveryInput(original, OUTBOUND_DELIVERY_INPUT_CODES.basedOnVersion)
      ?.valueString;
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
      recipientOrganization: recipient.organization,
      recipientPhone: recipient.phone,
      packetPageCount: packetSnapshot.pageCount,
      packetParts: packetSnapshot.parts,
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
        recipientOrganization: recipient.organization,
        recipientPhone: recipient.phone,
        packetPageCount: packetSnapshot.pageCount,
        packetParts: packetSnapshot.parts,
        documentReferenceId,
        requesterReference,
        senderOrganizationReference: `Organization/${organizationId}`,
        parentAttemptId: originalId,
        basedOnReference,
        basedOnVersionId,
        senderId: user.id,
        senderDisplay,
      }),
      { system: OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM, value: `Task/${originalId}` }
    );
    if (claim.status === 'existing') throw new Error('This delivery attempt has already been retried');
    retried = await deliverFaxAttempt(faxInput, oystehr, claim.attempt);
    const referralId = getIdFromReference(basedOnReference, 'ServiceRequest');
    if (referralId) await markReferralSent(referralId, basedOnVersionId, oystehr);
  } else {
    if (!emailClient) throw new Error('Visit note email client was not initialized');
    const emailAppointmentId = requireOutboundDeliveryValue(appointmentId, 'appointment reference');
    const [visitResult, visitNoteUrlResult] = await Promise.allSettled([
      getAppointmentAndRelatedResources(oystehr, emailAppointmentId, true),
      getPresignedURL(media, accessToken),
    ]);
    const visit = settledValueOrThrow(visitResult);
    if (!visit?.patient || !visit.location) throw new Error('Visit resources are incomplete');
    const visitNoteUrl = settledValueOrThrow(visitNoteUrlResult);
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
      appointmentId: emailAppointmentId,
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
        appointmentId: emailAppointmentId,
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

async function assertBasedOnReferralFaxable(task: Task, oystehr: Oystehr): Promise<void> {
  const referralId = getIdFromReference(task.basedOn?.[0]?.reference, 'ServiceRequest');
  if (!referralId) return;
  const serviceRequest = await oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: referralId });
  if (isReferralServiceRequest(serviceRequest)) assertReferralFaxable(serviceRequest);
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
  // A failed link email is usually a bad address; it is sent again from the Send dialog, not retried.
  if (isDocumentLinkAttempt(task)) return false;
  if (channel === 'email') return task.status === 'failed';
  const communicationId = getOutboundDeliveryRecipientSnapshot(task).communicationId;
  if (!communicationId) return task.status === 'failed';
  const communication = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: communicationId });
  return getOutboundDeliveryAttemptStatus(task, communication) === 'failed';
}

export async function resolveDocumentReference(
  task: Task,
  appointmentId: string | undefined,
  oystehr: Oystehr
): Promise<DocumentReference> {
  const storedReference = getOutboundDeliveryRecipientSnapshot(task).documentReferenceId;
  if (storedReference) {
    return oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: storedReference,
    });
  }

  const legacyAppointmentId = requireOutboundDeliveryValue(appointmentId, 'appointment reference');

  const resources = (
    await oystehr.fhir.search<Appointment | DocumentReference>({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: legacyAppointmentId },
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

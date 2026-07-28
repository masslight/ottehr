import Oystehr, { User } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Organization, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FaxDocumentAvailability,
  FaxRecipient,
  FaxSendResult,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getAddressString,
  getCoding,
  getFullestAvailableName,
  getNPI,
  getSecret,
  INVALID_INPUT_ERROR,
  isAnnotationFollowupEncounter,
  removePrefix,
  Secrets,
  SecretsKeys,
  SendFaxPacketInput,
  SendFaxPacketOutput,
  SERVICE_CATEGORY_SYSTEM,
  standardizePhoneNumber,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  sendFaxAttempt,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { buildAndUploadPacketForRecipient, buildFaxPacketBody } from '../../shared/fax/build-fax-packet';
import { resolveFaxDocumentAvailability } from '../../shared/fax/collect-visit-documents';
import { FaxCoverSheetData } from '../../shared/pdf/types';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { getPcpPatchOpsFromDetails } from '../shared/harvest';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-fax-packet';

const DEFAULT_TIMEZONE = 'America/New_York';

const DEFAULT_VISIT_TYPE_LABEL = 'Visit';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);

  console.log(
    `send-fax-packet appointment=${validatedInput.appointmentId} documents=${validatedInput.documents.join(',')} ` +
      `recipients=${validatedInput.recipients.length}`
  );

  const authorization = input.headers.Authorization;
  const user = await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  console.group('complexValidation()');
  const effectInput = await complexValidation(validatedInput, oystehr, user);
  console.groupEnd();

  console.group('performEffect()');
  const output = await performEffect(effectInput, oystehr, m2mToken);
  console.groupEnd();

  return { statusCode: 200, body: JSON.stringify(output) };
});

export interface SendFaxPacketEffectInput {
  request: SendFaxPacketInput;
  secrets: Secrets | null;
  visitResources: FullAppointmentResourcePackage;
  patient: Patient;
  organization: Organization;
  userPractitioner: Practitioner;
  senderId: string;
  organizationId: string;
}

const complexValidation = async (
  validatedInput: SendFaxPacketInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  user: User
): Promise<SendFaxPacketEffectInput> => {
  const { appointmentId, documents, recipients, secrets } = validatedInput;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
  const practitionerId = removePrefix('Practitioner/', user.profile);
  if (!practitionerId) throw new Error('User practitioner reference is invalid');

  const [visitResources, userPractitioner, organization] = await Promise.all([
    getAppointmentAndRelatedResources(oystehr, appointmentId, true),
    oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }),
    oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
  ]);

  if (!visitResources?.appointment?.id || !visitResources.encounter?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Visit resources could not be resolved for appointment ${appointmentId}`);
  }

  const patient = visitResources.patient;

  if (!patient?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No patient found for appointment ${appointmentId}`);
  }

  const availability = await resolveFaxDocumentAvailability({
    oystehr,
    appointmentId: visitResources.appointment.id,
    encounterId: visitResources.encounter.id,
  });

  assertRequestedDocumentsAvailable(documents, availability);

  return {
    request: { appointmentId, documents, recipients },
    secrets,
    visitResources,
    patient,
    organization,
    userPractitioner,
    senderId: user.id,
    organizationId,
  };
};

/** Rejects the whole request when any selected document is not actually available for this visit. */
export const assertRequestedDocumentsAvailable = (
  requested: SendFaxPacketInput['documents'],
  availability: FaxDocumentAvailability[]
): void => {
  const unavailable = requested.filter((kind) => !availability.some((entry) => entry.kind === kind && entry.available));

  if (unavailable.length > 0) {
    throw INVALID_INPUT_ERROR(`The following documents are not available for this visit: ${unavailable.join(', ')}`);
  }
};

/** "Follow-Up Visit" for annotation follow-ups, otherwise the appointment's service category. */
export const resolveVisitTypeLabel = (
  visitResources: Pick<FullAppointmentResourcePackage, 'appointment' | 'encounter'>
): string => {
  const encounter: Encounter | undefined = visitResources.encounter;

  if (encounter && isAnnotationFollowupEncounter(encounter)) return 'Follow-Up Visit';

  const coding = getCoding(visitResources.appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM);
  const label = coding?.display?.trim() || titleCaseCode(coding?.code);

  return label ? `${label} Visit` : DEFAULT_VISIT_TYPE_LABEL;
};

const titleCaseCode = (code: string | undefined): string | undefined =>
  code
    ?.split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || undefined;

/** MRN when the patient carries one, otherwise the FHIR id. Printed as PID on the cover sheet. */
export const resolvePatientDisplayId = (patient: Patient): string => {
  const mrn = patient.identifier?.find((identifier) => identifier.type?.coding?.some((coding) => coding.code === 'MR'))
    ?.value;

  return mrn?.trim() || patient.id || '';
};

export const performEffect = async (
  effectInput: SendFaxPacketEffectInput,
  oystehr: Oystehr,
  token: string
): Promise<SendFaxPacketOutput> => {
  const { request, secrets, visitResources, patient, organization, userPractitioner, senderId, organizationId } =
    effectInput;

  const appointmentId = visitResources.appointment.id!;
  const encounterId = visitResources.encounter.id!;
  const patientId = patient.id!;
  const timezone = visitResources.timezone || DEFAULT_TIMEZONE;

  const collectStart = Date.now();

  const body = await buildFaxPacketBody({
    oystehr,
    token,
    secrets,
    kinds: request.documents,
    visitResources,
  });

  console.log(
    `[fax-packet] collect+merge body took ${Date.now() - collectStart}ms; ` +
      `${body.parts.length} part(s), ${body.pageCount} page(s): ${body.parts.map((part) => part.title).join(' | ')}`
  );

  const coverSheet = buildSharedCoverSheetFields({
    visitResources,
    patient,
    organization,
    userPractitioner,
    timezone,
  });

  const results: FaxSendResult[] = [];
  let packetPageCount = body.pageCount;

  for (const recipient of request.recipients) {
    try {
      const coverStart = Date.now();
      const packet = await buildAndUploadPacketForRecipient({
        oystehr,
        token,
        secrets,
        body,
        recipient,
        coverSheet,
        patientId,
        appointmentId,
        encounterId,
        listResources: visitResources.listResources,
      });

      console.log(`[fax-packet] cover+merge+upload for ${recipient.faxNumber} took ${Date.now() - coverStart}ms`);

      packetPageCount = packet.pageCount;
      const sendStart = Date.now();

      const attempt = await sendFaxAttempt(
        {
          appointmentId,
          faxNumber: recipient.faxNumber,
          organizationId,
          patientId,
          media: packet.pdfInfo.uploadURL,
          documentReferenceId: packet.documentReference.id!,
          userPractitioner,
          recipientName: recipient.name,
          recipientOrganization: recipient.organization,
          recipientPhone: recipient.phoneNumber,
          faxPacketPageCount: packet.pageCount,
          faxPacketParts: body.parts.map((part) => part.title),
          senderId,
        },
        oystehr
      );

      console.log(`[fax-packet] send to ${recipient.faxNumber} took ${Date.now() - sendStart}ms`);

      results.push({
        recipient,
        status: 'sent',
        taskId: attempt.id,
        faxPacketDocumentReferenceId: packet.documentReference.id,
      });
    } catch (error) {
      // One bad recipient must not cost the others their fax.
      console.error(`[fax-packet] failed to send to ${recipient.faxNumber}`, error);
      captureException(error);
      results.push({
        recipient,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown fax delivery error',
      });
    }
  }

  const pcpSaveError = await savePcpIfRequested(request.recipients, patient, oystehr);

  return { pageCount: packetPageCount, results, ...(pcpSaveError ? { pcpSaveError } : {}) };
};

export const buildSharedCoverSheetFields = (args: {
  visitResources: FullAppointmentResourcePackage;
  patient: Patient;
  organization: Organization;
  userPractitioner: Practitioner;
  timezone: string;
}): Omit<FaxCoverSheetData, 'totalPages' | 'recipient'> => {
  const { visitResources, patient, organization, userPractitioner, timezone } = args;
  const { appointment, location } = visitResources;

  const dateOfService = appointment.start
    ? DateTime.fromISO(appointment.start).setZone(timezone).toFormat('MM/dd/yyyy')
    : '';

  const addressText = getAddressString(location?.address) || getAddressString(organization.address?.[0]);
  const organizationFax = organization.telecom?.find((telecom) => telecom.system === 'fax')?.value;
  const organizationPhone = organization.telecom?.find((telecom) => telecom.system === 'phone')?.value;

  return {
    sender: {
      practitionerName: getFullestAvailableName(userPractitioner) ?? '',
      npi: getNPI(userPractitioner),
      organizationName: organization.name ?? '',
      addressText,
      faxNumber: standardizePhoneNumber(organizationFax) ?? organizationFax,
      phoneNumber: standardizePhoneNumber(organizationPhone) ?? organizationPhone,
    },
    subject: {
      patientName: getFullestAvailableName(patient, true) ?? '',
      patientId: resolvePatientDisplayId(patient),
      visitId: appointment.id ?? '',
      dateOfService,
      visitTypeLabel: resolveVisitTypeLabel(visitResources),
    },
    generatedAt: DateTime.now().setZone(timezone).toFormat('MM/dd/yyyy  hh:mm a'),
  };
};

/** First token is the given name, the rest the family name. A single token is all family name. */
export const splitRecipientName = (name: string | undefined): { firstName?: string; lastName?: string } => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

/**
 * Persists the flagged recipient as the patient's PCP. Never throws: the fax has already gone out, so
 * a persistence failure is reported back rather than turning a successful send into an error.
 */
export const savePcpIfRequested = async (
  recipients: FaxRecipient[],
  patient: Patient,
  oystehr: Oystehr
): Promise<string | undefined> => {
  const toSave = recipients.filter((recipient) => recipient.saveAsPcp);
  if (toSave.length !== 1) return undefined;
  const recipient = toSave[0];

  try {
    const { firstName, lastName } = splitRecipientName(recipient.name);
    const operations = getPcpPatchOpsFromDetails(
      {
        firstName,
        lastName,
        practiceName: recipient.organization,
        fax: recipient.faxNumber,
        phone: recipient.phoneNumber,
        active: true,
      },
      patient
    );
    if (operations.length === 0) {
      console.log('[fax-packet] recipient already matches the stored PCP; nothing to persist');
      return undefined;
    }
    await oystehr.fhir.patch<Patient>({ resourceType: 'Patient', id: patient.id!, operations });
    console.log(`[fax-packet] saved recipient ${recipient.faxNumber} as PCP for Patient/${patient.id}`);
    return undefined;
  } catch (error) {
    console.error('[fax-packet] failed to save the recipient as the patient PCP', error);
    captureException(error);
    return error instanceof Error ? error.message : 'Unknown error saving the recipient as PCP';
  }
};

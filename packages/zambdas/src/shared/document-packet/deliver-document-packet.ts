import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getAddressString, getCoding, getNPI, getOrganizationFaxNumber } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import {
  DOCUMENT_PACKET_MAX_PAGES,
  DocumentPacketRecipient,
  DocumentPacketRecipientResult,
  formatRecipientName,
  isEmailRecipient,
} from 'utils/lib/types/api/document-packet.types';
import { getLocationContactPhone } from 'utils/lib/utils/support-dialog';
import { getPcpPatchOpsFromDetails } from '../../ehr/shared/harvest';
import { sendDocumentLinkEmailAttempt } from '../document-link-email';
import { PacketCoverSheetData } from '../pdf/types';
import { FullAppointmentResourcePackage } from '../pdf/visit-details-pdf/types';
import { sendFaxAttempt } from '../send-fax-attempt';
import {
  buildPacketForRecipient,
  documentPacketLimitGuidance,
  DocumentPacketTooLargeError,
  toDocumentPacketBody,
  uploadDocumentPacket,
} from './build-document-packet';
import { DocumentPacketPlan } from './resolve-packet-source';

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_VISIT_TYPE_LABEL = 'Visit';

/**
 * Builds the packet body once and sends it to every recipient. One recipient's failure never blocks the
 * others, except a packet over the size limit, which fails the whole send before anything is uploaded or
 * sent; the raw cause is logged/captured server-side while the returned result only carries sent/failed.
 */
export const deliverDocumentPacket = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  plan: DocumentPacketPlan;
  organization: Organization;
  senderPractitioner: Practitioner;
  senderUserId: string;
  organizationId: string;
  recipients: DocumentPacketRecipient[];
}): Promise<DocumentPacketRecipientResult[]> => {
  const { oystehr, token, secrets, plan, organization, senderPractitioner, senderUserId } = args;
  const { organizationId, recipients } = args;

  const { patient, appointmentId, encounterId } = plan;
  const patientId = patient.id!;
  const timezone = plan.timezone || organizationTimezone(organization) || DEFAULT_TIMEZONE;

  if (plan.sections.length === 0) {
    throw new Error('No documents could be collected for the document packet. Nothing was sent.');
  }
  const body = toDocumentPacketBody(plan.sections);
  // Each section requires at least one cover page. Reject a body that cannot possibly fit before
  // repeating cover rendering and full-packet merging for every recipient.
  const projectedPageCount = body.pageCount + body.sections.length;
  if (projectedPageCount > DOCUMENT_PACKET_MAX_PAGES) {
    throw new Error(
      `Document packet is ${projectedPageCount} pages, which exceeds the ${DOCUMENT_PACKET_MAX_PAGES} page limit. ` +
        documentPacketLimitGuidance(plan.sourceType)
    );
  }
  console.log(
    `[document-packet] built body: ${body.sections.length} section(s), ${body.parts.length} part(s), ` +
      `${body.pageCount} page(s)`
  );

  const coverSheet = buildSenderCoverSheetFields({
    organization,
    senderPractitioner,
    location: plan.location,
    timezone,
  });

  const packets: (Awaited<ReturnType<typeof buildPacketForRecipient>> | undefined)[] = [];
  for (const recipient of recipients) {
    try {
      packets.push(await buildPacketForRecipient({ body, recipient, coverSheet, sourceType: plan.sourceType }));
    } catch (error) {
      if (error instanceof DocumentPacketTooLargeError) throw error;
      console.log(`[document-packet] failed to send to ${recipientLogLabel(recipient)}`, error);
      captureException(error);
      packets.push(undefined);
    }
  }

  const results: DocumentPacketRecipientResult[] = [];
  for (const [index, recipient] of recipients.entries()) {
    const base: DocumentPacketRecipientResult = {
      name: formatRecipientName(recipient),
      organization: recipient.organization,
      faxNumber: recipient.faxNumber,
      email: recipient.email,
      phoneNumber: recipient.phoneNumber,
      status: 'failed',
    };
    const packet = packets[index];
    if (!packet) {
      results.push(base);
      continue;
    }
    try {
      const uploaded = await uploadDocumentPacket({
        oystehr,
        token,
        secrets,
        packet,
        patientId,
        appointmentId,
        encounterId,
        listResources: plan.listResources,
      });

      await sendPacketToRecipient({
        oystehr,
        secrets,
        recipient,
        uploaded,
        partTitles: body.parts.map((part) => part.title),
        plan,
        senderPractitioner,
        senderUserId,
        organizationId,
      });

      results.push({ ...base, status: 'sent' });
    } catch (error) {
      // The raw cause stays server-side; the UI only ever learns sent/failed.
      console.error(`[document-packet] failed to send to ${recipientLogLabel(recipient)}`, error);
      captureException(error);
      results.push(base);
    }
  }

  return results;
};

/** An email address identifies a person, so only a fax number goes to the logs. */
const recipientLogLabel = (recipient: DocumentPacketRecipient): string => recipient.faxNumber ?? 'an email recipient';

/** Delivers an uploaded packet over the recipient's channel: an emailed link, or a fax. */
const sendPacketToRecipient = async (args: {
  oystehr: Oystehr;
  secrets: Secrets | null;
  recipient: DocumentPacketRecipient;
  uploaded: Awaited<ReturnType<typeof uploadDocumentPacket>>;
  partTitles: string[];
  plan: DocumentPacketPlan;
  senderPractitioner: Practitioner;
  senderUserId: string;
  organizationId: string;
}): Promise<void> => {
  const { oystehr, secrets, recipient, uploaded, plan, senderPractitioner } = args;
  const attempt = {
    patientId: plan.patient.id!,
    appointmentId: plan.appointmentId,
    organizationId: args.organizationId,
    documentReferenceId: uploaded.documentReference.id!,
    recipientName: formatRecipientName(recipient),
    recipientOrganization: recipient.organization,
    recipientPhone: recipient.phoneNumber,
    packetPageCount: uploaded.pageCount,
    packetParts: args.partTitles,
    senderId: args.senderUserId,
  };

  if (isEmailRecipient(recipient)) {
    await sendDocumentLinkEmailAttempt({
      ...attempt,
      oystehr,
      secrets,
      email: recipient.email,
      contactPhone: getLocationContactPhone(plan.location),
      senderDisplay: getFullestAvailableName(senderPractitioner),
      requesterReference: senderPractitioner.id ? `Practitioner/${senderPractitioner.id}` : undefined,
    });
    return;
  }
  await sendFaxAttempt(
    {
      ...attempt,
      faxNumber: recipient.faxNumber,
      media: uploaded.pdfInfo.uploadURL,
      userPractitioner: senderPractitioner,
    },
    oystehr
  );
};

/** The From block and the timestamp: everything on the cover that is the same for every section. */
export const buildSenderCoverSheetFields = (args: {
  organization: Organization;
  senderPractitioner: Practitioner;
  location?: Location;
  timezone: string;
}): Omit<PacketCoverSheetData, 'totalPages' | 'recipient' | 'subject'> => {
  const { organization, senderPractitioner, location, timezone } = args;

  const addressText = getAddressString(location?.address) || getAddressString(organization.address?.[0]);
  const organizationFax = getOrganizationFaxNumber(organization);
  const organizationPhone = organization.telecom?.find((telecom) => telecom.system === 'phone')?.value;

  return {
    sender: {
      practitionerName: getFullestAvailableName(senderPractitioner) ?? '',
      npi: getNPI(senderPractitioner),
      organizationName: organization.name ?? '',
      addressText: addressText ?? '',
      faxNumber: standardizePhoneNumber(organizationFax) ?? organizationFax,
      phoneNumber: standardizePhoneNumber(organizationPhone) ?? organizationPhone,
    },
    generatedAt: DateTime.now().setZone(timezone).toFormat('MM/dd/yyyy  hh:mm a'),
  };
};

/** Sender fields plus the subject of a single-visit packet. */
export const buildSharedCoverSheetFields = (args: {
  visitResources: FullAppointmentResourcePackage;
  patient: Patient;
  organization: Organization;
  senderPractitioner: Practitioner;
  timezone: string;
}): Omit<PacketCoverSheetData, 'totalPages' | 'recipient'> => {
  const { visitResources, patient, organization, senderPractitioner, timezone } = args;
  const { appointment, location } = visitResources;

  return {
    ...buildSenderCoverSheetFields({ organization, senderPractitioner, location, timezone }),
    subject: {
      patientName: getFullestAvailableName(patient, true) ?? '',
      patientId: resolvePatientDisplayId(patient),
      visitId: appointment.id ?? '',
      dateOfService: appointment.start
        ? DateTime.fromISO(appointment.start).setZone(timezone).toFormat('MM/dd/yyyy')
        : '',
      visitTypeLabel: resolveVisitTypeLabel(visitResources),
    },
  };
};

/** The practice's own timezone, for packets with no visit whose office timezone could be used. */
const organizationTimezone = (organization: Organization): string | undefined =>
  organization.extension?.find((extension) => extension.url === TIMEZONE_EXTENSION_URL)?.valueString;

/** "Follow-Up Visit" for annotation follow-ups, otherwise the appointment's service category, else "Visit". */
export const resolveVisitTypeLabel = (
  visitResources: Pick<FullAppointmentResourcePackage, 'appointment' | 'encounter'>
): string => {
  const { encounter, appointment } = visitResources;
  if (encounter && isAnnotationFollowupEncounter(encounter)) return 'Follow-Up Visit';

  const coding = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM);
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

/** First token is the given name, the rest the family name. A single token is all family name. */
export const splitRecipientName = (name: string | undefined): { firstName?: string; lastName?: string } => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

/**
 * Persists the flagged recipient as the patient's PCP. Never throws — a failure here must not fail the send.
 * The PCP record holds a fax number but no email, so an email recipient is never saved.
 */
export const savePcpIfRequested = async (
  recipients: DocumentPacketRecipient[],
  patient: Patient,
  oystehr: Oystehr
): Promise<void> => {
  const toSave = recipients.filter((recipient) => recipient.saveAsPcp && !isEmailRecipient(recipient));

  if (toSave.length !== 1) return;

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

    if (operations.length === 0) return;

    await oystehr.fhir.patch<Patient>({ resourceType: 'Patient', id: patient.id!, operations });

    console.log(`[document-packet] saved recipient ${recipient.faxNumber} as PCP for Patient/${patient.id}`);
  } catch (error) {
    console.error('[document-packet] failed to save the recipient as the patient PCP', error);
    captureException(error);
  }
};

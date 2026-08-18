import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getAddressString, getCoding, getNPI } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { FAX_PACKET_MAX_PAGES, FaxRecipient, FaxRecipientResult } from 'utils/lib/types/api/fax.types';
import { getPcpPatchOpsFromDetails } from '../../ehr/shared/harvest';
import { FaxCoverSheetData } from '../pdf/types';
import { FullAppointmentResourcePackage } from '../pdf/visit-details-pdf/types';
import { sendFaxAttempt } from '../send-fax-attempt';
import { buildAndUploadPacketForRecipient, faxPacketLimitGuidance, toFaxPacketBody } from './build-fax-packet';
import { FaxPacketPlan } from './resolve-fax-source';

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_VISIT_TYPE_LABEL = 'Visit';

/**
 * Builds the packet body once and sends it to every recipient. One recipient's failure never blocks the
 * others; the raw cause is logged/captured server-side while the returned result only carries sent/failed.
 */
export const deliverFaxPacket = async (args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  plan: FaxPacketPlan;
  organization: Organization;
  senderPractitioner: Practitioner;
  senderUserId: string;
  organizationId: string;
  recipients: FaxRecipient[];
}): Promise<FaxRecipientResult[]> => {
  const { oystehr, token, secrets, plan, organization, senderPractitioner, senderUserId } = args;
  const { organizationId, recipients } = args;

  const { patient, appointmentId, encounterId } = plan;
  const patientId = patient.id!;
  const timezone = plan.timezone || organizationTimezone(organization) || DEFAULT_TIMEZONE;

  if (plan.sections.length === 0) {
    throw new Error('No documents could be collected for the fax packet. Nothing was sent.');
  }
  const body = toFaxPacketBody(plan.sections);
  // Each section requires at least one cover page. Reject a body that cannot possibly fit before
  // repeating cover rendering and full-packet merging for every recipient.
  const projectedPageCount = body.pageCount + body.sections.length;
  if (projectedPageCount > FAX_PACKET_MAX_PAGES) {
    throw new Error(
      `Fax packet is ${projectedPageCount} pages, which exceeds the ${FAX_PACKET_MAX_PAGES} page limit. ` +
        faxPacketLimitGuidance(plan.sourceType)
    );
  }
  console.log(
    `[fax-packet] built body: ${body.sections.length} section(s), ${body.parts.length} part(s), ` +
      `${body.pageCount} page(s)`
  );

  const coverSheet = buildSenderCoverSheetFields({
    organization,
    senderPractitioner,
    location: plan.location,
    timezone,
  });

  const results: FaxRecipientResult[] = [];
  for (const recipient of recipients) {
    const base: FaxRecipientResult = {
      name: recipient.name,
      organization: recipient.organization,
      faxNumber: recipient.faxNumber,
      phoneNumber: recipient.phoneNumber,
      status: 'failed',
    };
    try {
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
        sourceType: plan.sourceType,
        listResources: plan.listResources,
      });

      await sendFaxAttempt(
        {
          appointmentId,
          faxNumber: recipient.faxNumber,
          organizationId,
          patientId,
          media: packet.pdfInfo.uploadURL,
          documentReferenceId: packet.documentReference.id!,
          userPractitioner: senderPractitioner,
          recipientName: recipient.name,
          recipientOrganization: recipient.organization,
          recipientPhone: recipient.phoneNumber,
          faxPacketPageCount: packet.pageCount,
          faxPacketParts: body.parts.map((part) => part.title),
          senderId: senderUserId,
        },
        oystehr
      );

      results.push({ ...base, status: 'sent' });
    } catch (error) {
      // The raw cause stays server-side; the UI only ever learns sent/failed.
      console.error(`[fax-packet] failed to send to ${recipient.faxNumber}`, error);
      captureException(error);
      results.push(base);
    }
  }

  return results;
};

/** The From block and the timestamp: everything on the cover that is the same for every section. */
export const buildSenderCoverSheetFields = (args: {
  organization: Organization;
  senderPractitioner: Practitioner;
  location?: Location;
  timezone: string;
}): Omit<FaxCoverSheetData, 'totalPages' | 'recipient' | 'subject'> => {
  const { organization, senderPractitioner, location, timezone } = args;

  const addressText = getAddressString(location?.address) || getAddressString(organization.address?.[0]);
  const organizationFax = organization.telecom?.find((telecom) => telecom.system === 'fax')?.value;
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
}): Omit<FaxCoverSheetData, 'totalPages' | 'recipient'> => {
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

/** Persists the flagged recipient as the patient's PCP. Never throws — a failure here must not fail the send. */
export const savePcpIfRequested = async (
  recipients: FaxRecipient[],
  patient: Patient,
  oystehr: Oystehr
): Promise<void> => {
  const toSave = recipients.filter((recipient) => recipient.saveAsPcp);

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

    console.log(`[fax-packet] saved recipient ${recipient.faxNumber} as PCP for Patient/${patient.id}`);
  } catch (error) {
    console.error('[fax-packet] failed to save the recipient as the patient PCP', error);
    captureException(error);
  }
};

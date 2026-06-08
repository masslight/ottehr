import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, EncounterStatusHistory, Extension, Location, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CODE_SYSTEM_ACT_CODE_V3 } from '../helpers';
import { FhirEncounterStatus, PatientFollowupDetails, ProviderDetails, VisitStatusWithoutUnknown } from '../types';
import { ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, FHIR_BASE_URL, FHIR_EXTENSION } from './constants';

// follow up encounter consts
export const FOLLOWUP_TYPES = ['Follow-up Encounter'] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

export type FollowupSubtype = 'annotation' | 'scheduled';
export const FOLLOWUP_SUBTYPE_SYSTEM = `${FHIR_BASE_URL}/followup-subtype`;

export const FOLLOWUP_REASONS = [
  'Result - Lab',
  'Result - Radiology',
  'Order - Lab',
  'Order - Radiology',
  'Order - eRX',
  'Clinical Follow-up',
  'Splint or DME',
  'Immigration Screening',
  'Other',
] as const;
type FollowupReasons = (typeof FOLLOWUP_REASONS)[number];
export type FollowupReason = FollowupReasons;

// Reason-for-visit options shown when booking a scheduled follow-up visit (replaces the
// service-category reason-for-visit list for that flow). "Other" reveals a free-text field; if the
// follow-up reason matches the initial visit's reason for visit, the provider enters it there.
export const SCHEDULED_FOLLOWUP_REASONS = [
  'Suture / Staple Removal',
  'Dressing Change',
  'DOT / CDL Medical Hold Completion',
  'Immigration Exam (I-693) Finalization',
  'Work Status / Fit-for-Duty Clearance',
  'Post-Accident Follow-up (Auto/Work)',
  'Drug / Alcohol Screen Collection',
  'Test Results Review (Lab/Imaging)',
  'Tuberculosis (PPD) Skin Test Read',
  'Other',
] as const;
export type ScheduledFollowupReason = (typeof SCHEDULED_FOLLOWUP_REASONS)[number];
export const SCHEDULED_FOLLOWUP_OTHER_REASON: ScheduledFollowupReason = 'Other';

export const FOLLOWUP_SYSTEMS = {
  callerUrl: `${FHIR_BASE_URL}/followup-caller`,
  answeredUrl: `${FHIR_BASE_URL}/followup-answered`,
  providerUrl: `${FHIR_BASE_URL}/followup-provider`,
  messageUrl: `${FHIR_BASE_URL}/followup-message`,
  reasonUrl: `${FHIR_BASE_URL}/followup-reason`,
  type: {
    url: 'http://snomed.info/sct',
    code: '390906007', // Follow-up encounter (procedure)
  },
};

export const isFollowupEncounter = (encounter: Encounter): boolean => {
  return (
    encounter.type?.some(
      (type) =>
        type.coding?.some(
          (coding) => coding.system === FOLLOWUP_SYSTEMS.type.url && coding.code === FOLLOWUP_SYSTEMS.type.code
        )
    ) ?? false
  );
};

export const getFollowupSubtype = (encounter: Encounter): FollowupSubtype | undefined => {
  if (!isFollowupEncounter(encounter)) return undefined;
  const subtypeCoding = encounter.type
    ?.flatMap((t) => t.coding ?? [])
    .find((c) => c.system === FOLLOWUP_SUBTYPE_SYSTEM);
  if (subtypeCoding?.code === 'scheduled') return 'scheduled';
  return 'annotation';
};

export const isScheduledFollowupEncounter = (encounter: Encounter): boolean => {
  return getFollowupSubtype(encounter) === 'scheduled';
};

export const isAnnotationFollowupEncounter = (encounter: Encounter): boolean => {
  return isFollowupEncounter(encounter) && !isScheduledFollowupEncounter(encounter);
};

export type EncounterVisitType = 'main' | 'follow-up' | 'scheduled-follow-up';

export const getEncounterVisitType = (encounter?: Encounter): EncounterVisitType => {
  if (encounter && isFollowupEncounter(encounter)) {
    if (isScheduledFollowupEncounter(encounter)) {
      return 'scheduled-follow-up';
    }
    return 'follow-up';
  }
  return 'main';
};

export const formatFhirEncounterToPatientFollowupDetails = (
  encounter: Encounter,
  patientId: string,
  location?: Location
): PatientFollowupDetails => {
  const followupType =
    encounter.type?.find(
      (t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.type.url && c.code === FOLLOWUP_SYSTEMS.type.code)
    )?.text || '';
  const reason = encounter?.reasonCode?.[0].coding?.[0].display || '';
  const otherReason = encounter?.reasonCode?.[0].text;
  const answered =
    encounter?.participant?.find(
      (p) => p.type?.find((t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.answeredUrl))
    )?.type?.[0].coding?.[0].display || '';
  const caller =
    encounter?.participant?.find(
      (p) => p.type?.find((t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.callerUrl))
    )?.type?.[0].coding?.[0].display || '';
  const start = encounter.period?.start || DateTime.now().toISO();
  const end = encounter.period?.end;
  const message = encounter?.extension?.find((ext) => ext.url === FOLLOWUP_SYSTEMS.messageUrl)?.valueString || '';

  const provider = encounter?.participant?.find(
    (p) => p.type?.find((t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.providerUrl))
  );
  let formattedProvider: ProviderDetails | undefined;
  if (provider) {
    const name = provider.type?.[0].coding?.[0].display || 'name not entered';
    formattedProvider = {
      practitionerId: provider.individual?.reference?.split('/')[1] || '',
      name,
    };
  }

  const formatted: PatientFollowupDetails = {
    encounterId: encounter.id,
    patientId,
    followupType: followupType as FollowupType,
    reason: (reason as FollowupReason) || undefined,
    otherReason,
    answered,
    caller,
    start,
    message,
    location: location,
    provider: formattedProvider,
    resolved: !!end,
  };

  return formatted;
};

export const getEncounterForAppointment = async (appointmentID: string, oystehr: Oystehr): Promise<Encounter> => {
  const encounterTemp = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: 'appointment',
          value: `Appointment/${appointmentID}`,
        },
      ],
    })
  ).unbundle();
  const encounter = encounterTemp[0];
  if (encounterTemp.length === 0 || !encounter.id) {
    throw new Error('Error getting appointment encounter');
  }
  return encounter;
};

export const getSpentTime = (history?: EncounterStatusHistory[]): string | undefined => {
  const value = history?.find((item) => item.status === 'in-progress');
  if (!value || !value.period.start) {
    return;
  }

  const { start, end } = value.period;
  const startTime = DateTime.fromISO(start);
  const endTime = end ? DateTime.fromISO(end) : DateTime.now();
  const duration = startTime.diff(endTime, ['minute']);

  const minutesSpent = Math.round(Math.abs(duration.minutes));

  return `${minutesSpent}`;
};

export const getEncounterStatusHistoryUpdateOp = (
  encounter: Encounter,
  newStatus: FhirEncounterStatus,
  ottehrVisitStatus: VisitStatusWithoutUnknown
): Operation => {
  const now = DateTime.now().setZone('UTC').toISO() || '';

  const newStatusHistory: EncounterStatusHistory = {
    status: newStatus,
    period: {
      start: now,
    },
  };

  newStatusHistory.extension = [
    {
      url: FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url,
      valueCode: ottehrVisitStatus,
    },
  ];

  let statusHistory = encounter.statusHistory;
  const op = statusHistory ? 'replace' : 'add';

  if (statusHistory) {
    const curStatus = encounter.statusHistory?.find((h) => !h.period.end);

    const didFhirStatusHistoryChange = curStatus?.status !== newStatus;

    const ottehrHistoryStatusExtension = curStatus?.extension?.find(
      (ext) => ext.url === FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url
    );

    const didOttEhrStatusHistoryChange = ottehrHistoryStatusExtension?.valueCode !== ottehrVisitStatus;

    if (curStatus && (didFhirStatusHistoryChange || didOttEhrStatusHistoryChange)) {
      const startTime = curStatus.period.start;
      curStatus.period.end = startTime && startTime > now ? startTime : now;
      statusHistory.push(newStatusHistory);
    } else if (!curStatus) {
      statusHistory.push(newStatusHistory);
    }
  } else {
    statusHistory = [newStatusHistory];
  }

  const statusHistoryUpdate: Operation = {
    op,
    path: '/statusHistory',
    value: statusHistory,
  };

  return statusHistoryUpdate;
};

export const checkEncounterIsVirtual = (encounter: Encounter): boolean => {
  const encounterClass = encounter.class;
  if (!encounterClass) {
    return false;
  }
  return encounterClass.system === CODE_SYSTEM_ACT_CODE_V3 && encounterClass.code === 'VR';
};

export enum PaymentVariant {
  insurance = 'insurance',
  selfPay = 'selfPay',
  employer = 'employer',
}

export const getPaymentVariantFromEncounter = (encounter: Encounter): PaymentVariant | undefined => {
  return encounter.extension?.find((ext) => ext.url === ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL)
    ?.valueString as PaymentVariant;
};

export const getEncounterPaymentVariantExtension = (paymentVariant: PaymentVariant): Extension => {
  return {
    url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
    valueString: paymentVariant,
  };
};

export const updateEncounterPaymentVariantExtension = (input: Encounter, paymentVariant: PaymentVariant): Encounter => {
  const encounter = { ...input };
  if (encounter.extension) {
    const extIndex = encounter.extension.findIndex((ext) => ext.url === ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL);

    if (extIndex >= 0) {
      encounter.extension[extIndex].valueString = paymentVariant;
    } else {
      encounter.extension.push(getEncounterPaymentVariantExtension(paymentVariant));
    }
  } else {
    encounter.extension = [getEncounterPaymentVariantExtension(paymentVariant)];
  }
  return encounter;
};

export const isEncounterSelfPay = (encounter?: Encounter): boolean => {
  if (!encounter) return false;
  const paymentVariant = getPaymentVariantFromEncounter(encounter);
  return paymentVariant === PaymentVariant.selfPay;
};

export const buildAppointmentStartMap = (resources: Resource[]): Record<string, string> => {
  const map: Record<string, string> = {};
  resources.forEach((r) => {
    if (r.resourceType === 'Appointment' && r.id && (r as Appointment).start) {
      map[r.id] = (r as Appointment).start!;
    }
  });
  return map;
};

// Resolves the best available datetime for an encounter
export const getEncounterDateTime = (
  encounter: Encounter,
  appointmentStartMap: Record<string, string>
): string | undefined => {
  // Annotation follow-ups share the parent appointment reference rather than having their own,
  // so the appointment start would give the main visit time — use period.start instead.
  if (!isAnnotationFollowupEncounter(encounter)) {
    const apptId = encounter.appointment?.[0]?.reference?.replace('Appointment/', '');
    if (apptId && appointmentStartMap[apptId]) return appointmentStartMap[apptId];
  }
  if (encounter.period?.start) return encounter.period.start;
  return encounter.statusHistory?.[0]?.period?.start;
};

export const getEncounterDisplayName = (
  encounter: Encounter,
  appointmentStartMap: Record<string, string>,
  formatDateTime: (iso: string) => string
): string => {
  const dateTime = getEncounterDateTime(encounter, appointmentStartMap);
  const dateStr = dateTime ? formatDateTime(dateTime) : '';
  if (!encounter.partOf) {
    return `Main Visit${dateStr ? ` - ${dateStr}` : ''}`;
  }
  const typeText = encounter.type?.[0]?.text || 'Follow-up';
  return `${typeText}${dateStr ? ` - ${dateStr}` : ''}`;
};

export const getAnnotationFollowupStatusLabel = (encounterStatus: string | undefined): 'OPEN' | 'RESOLVED' => {
  return encounterStatus === 'in-progress' ? 'OPEN' : 'RESOLVED';
};

/**
 * Determines which encounter should be pre-selected as the "initial visit"
 * when creating a new follow-up from the current visit context.
 * If the current encounter is itself a follow-up child (has partOf), the parent
 * (followUpOriginEncounter) is the initial visit; otherwise the current encounter is.
 */
export const getInitialEncounterIdForFollowUp = (
  encounter: Encounter | undefined,
  followUpOriginEncounter: Encounter | undefined
): string | undefined => {
  return encounter?.partOf ? followUpOriginEncounter?.id : encounter?.id;
};

export const getFollowUpProgressNotePathSegment = (
  followupSubtype: FollowupSubtype | undefined
): 'review-and-sign' | 'follow-up-note' => {
  if (followupSubtype === 'scheduled') {
    return 'review-and-sign';
  }
  return 'follow-up-note';
};

export const getInteractionModeForEncounter = (
  encounter: Encounter,
  followUpOriginEncounterId: string | undefined
): 'main' | 'follow-up' => {
  if (encounter.id === followUpOriginEncounterId) return 'main';
  if (isScheduledFollowupEncounter(encounter)) return 'main';
  return 'follow-up';
};

export const getEncounterLocationId = (encounter: Encounter | undefined): string | undefined => {
  const locationRef = encounter?.location?.[0]?.location?.reference;
  return locationRef?.split('/')[1];
};

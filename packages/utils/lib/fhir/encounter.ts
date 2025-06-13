import Oystehr from '@oystehr/sdk';
import { Encounter, EncounterStatusHistory, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  TelemedStatusHistoryElement,
  mapStatusToTelemed,
  FhirEncounterStatus,
  PatientFollowupDetails,
  ProviderDetails,
} from '../types';
import { Operation } from 'fast-json-patch';
import { FHIR_BASE_URL } from './constants';
import { CODE_SYSTEM_ACT_CODE_V3 } from '../helpers';

// follow up encounter consts
export const FOLLOWUP_TYPES = ['Telephone Encounter', 'Non-Billable'] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

export const TELEPHONE_REASONS = [
  'Culture Positive; Group A Strep',
  'Culture Positive; Other',
  'Culture Positive; Urine',
  'Culture Positive; Wound',
  'Lab Call Back; Change of Antibiotics',
  'Lab Call Back; Needs Prescription',
  'Medication Change or Resend',
  'Medication Refill Request Spilled, ran out too early, etc.',
] as const;
export const NON_BILLABLE_REASONS = [
  'Presents for Splints/Crutches',
  'Presents with Specimen',
  'Adolescent/Adult Discussion',
] as const;
type TelephoneReasons = (typeof TELEPHONE_REASONS)[number];
type NonBillableReasons = (typeof NON_BILLABLE_REASONS)[number];
export type FollowupReason = TelephoneReasons | NonBillableReasons;

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

export const formatFhirEncounterToPatientFollowupDetails = (
  encounter: Encounter,
  patientId: string,
  location?: Location
): PatientFollowupDetails => {
  const followupType =
    encounter.type?.find(
      (t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.type.url && c.code === FOLLOWUP_SYSTEMS.type.code)
    )?.text || '';
  const reason = encounter?.reasonCode?.[0].text || '';
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

export const mapEncounterStatusHistory = (
  statusHistory: EncounterStatusHistory[],
  appointmentStatus: string
): TelemedStatusHistoryElement[] => {
  const result: TelemedStatusHistoryElement[] = [];

  statusHistory.forEach((statusElement) => {
    result.push({
      start: statusElement.period.start,
      end: statusElement.period.end,
      status: mapStatusToTelemed(statusElement.status, undefined),
    });
  });
  if (appointmentStatus === 'fulfilled' && result.at(-1)?.status === 'unsigned') {
    result.push({
      start: result.at(-1)?.end,
      status: 'complete',
    });
  }

  return result;
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

export const getEncounterStatusHistoryUpdateOp = (encounter: Encounter, newStatus: FhirEncounterStatus): Operation => {
  const now = DateTime.now().setZone('UTC').toISO() || '';
  const newStatusHistory: EncounterStatusHistory = {
    status: newStatus,
    period: {
      start: now,
    },
  };
  let statusHistory = encounter.statusHistory;
  const op = statusHistory ? 'replace' : 'add';
  if (statusHistory) {
    const curStatus = encounter.statusHistory?.find((h) => !h.period.end);
    if (curStatus && curStatus?.status !== newStatus) {
      curStatus.period.end = now;
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

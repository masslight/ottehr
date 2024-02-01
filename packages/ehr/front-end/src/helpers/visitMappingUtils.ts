import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Period } from 'fhir/r4';
import { DateTime } from 'luxon';

export const ZAPEHR_ID_TYPE = 'ZapEHR ID';

export const STATI = [
  'ARRIVED',
  'CANCELLED',
  'INTAKE',
  'NO-SHOW',
  'PENDING',
  'PROVIDER',
  'READY',
  'CHECKED-OUT',
  'DISCHARGE',
  'PROVIDER-READY',
  'UNKNOWN',
] as const;
type STATI_LIST = typeof STATI;
export type OtherEHRVisitStatus = STATI_LIST[number];

type AppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'arrived'
  | 'booked'
  | 'cancelled'
  | 'waitlist'
  | 'checked-in'
  | 'entered-in-error'
  | 'fulfilled'
  | 'noshow';

type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

const otherEHRVisitStatusExtensionUrl = 'https://fhir.zapehr.com/r4/StructureDefinitions/visit-history';
export type OtherEHRVisitStatusExtensionEntry = {
  url: 'status';
  extension: [{ url: 'status'; valueString: OtherEHRVisitStatus }, { url: 'period'; valuePeriod: Period }];
};
export type OtherEHRVisitStatusExtension = {
  url: string;
  extension: OtherEHRVisitStatusExtensionEntry[];
};

export type OtherEHRVisitStatusWithoutUnknown = Exclude<OtherEHRVisitStatus, 'UNKNOWN'>;
const otherEHRToFhirAppointmentStatusMap: Record<OtherEHRVisitStatusWithoutUnknown, AppointmentStatus> = {
  PENDING: 'booked',
  ARRIVED: 'arrived',
  READY: 'checked-in',
  INTAKE: 'checked-in',
  'PROVIDER-READY': 'fulfilled',
  PROVIDER: 'fulfilled',
  DISCHARGE: 'fulfilled',
  'CHECKED-OUT': 'fulfilled',
  CANCELLED: 'cancelled',
  'NO-SHOW': 'noshow',
};

export function makeOtherEHRVisitStatusExtensionEntry(
  statusCode: OtherEHRVisitStatus,
  dateTimeISO?: string,
): OtherEHRVisitStatusExtensionEntry {
  return {
    url: 'status',
    extension: [
      { url: 'status', valueString: statusCode },
      {
        url: 'period',
        valuePeriod: { start: dateTimeISO ?? (DateTime.now().setZone('UTC').toISO() || undefined) },
      },
    ],
  };
}

export const mapOtherEHRVisitStatusToFhirAppointmentStatus = (
  apptStatus: OtherEHRVisitStatusWithoutUnknown,
): AppointmentStatus => {
  return otherEHRToFhirAppointmentStatusMap[apptStatus] ?? 'proposed'; // 'fulfilled' maybe?
};

const otherEHRToFhirEncounterStatusMap: Record<OtherEHRVisitStatusWithoutUnknown, EncounterStatus> = {
  PENDING: 'planned',
  ARRIVED: 'arrived',
  READY: 'arrived',
  INTAKE: 'arrived',
  'PROVIDER-READY': 'arrived',
  PROVIDER: 'in-progress',
  DISCHARGE: 'in-progress',
  'CHECKED-OUT': 'finished',
  CANCELLED: 'cancelled',
  'NO-SHOW': 'cancelled',
};

export const mapOtherEHRVisitStatusToFhirEncounterStatus = (
  apptStatus: OtherEHRVisitStatusWithoutUnknown,
): EncounterStatus => {
  return otherEHRToFhirEncounterStatusMap[apptStatus] ?? 'unknown';
};

type AppOrEncounter = Appointment | Encounter;
export const getPatchOperationsToUpdateVisitStatus = <T extends AppOrEncounter>(
  resource: T,
  statusCode: OtherEHRVisitStatus,
  dateTimeISO?: string,
): Operation[] => {
  if (resource.extension == undefined) {
    return [
      {
        op: 'add',
        path: '/extension',
        value: [makeOtherEHRVisitStatusExtensionEntry(statusCode, dateTimeISO)],
      },
    ];
  }
  const extensions = resource.extension ?? [];
  const existingVisitStatusExtIdx = extensions.findIndex((ext) => ext.url === otherEHRVisitStatusExtensionUrl);
  if (existingVisitStatusExtIdx === -1) {
    return [
      {
        op: 'add',
        path: '/extension/-',
        value: makeOtherEHRVisitStatusExtensionEntry(statusCode, dateTimeISO),
      },
    ];
  }
  const existingVisitStatusExt = extensions[existingVisitStatusExtIdx] as OtherEHRVisitStatusExtension;
  const statusList = existingVisitStatusExt.extension;
  if (statusList == undefined) {
    return [
      {
        op: 'add',
        path: `/extension/${existingVisitStatusExtIdx}/extension`,
        value: makeOtherEHRVisitStatusExtensionEntry(statusCode, dateTimeISO).extension,
      },
    ];
  }

  const operations: Operation[] = [];
  let needsInsert = true;
  statusList.forEach((statusHistoryItem, index) => {
    const { extension } = statusHistoryItem;
    const isNewValue = extension[0].valueString !== statusCode;
    const period = extension[1].valuePeriod;
    if (isNewValue) {
      if (period.end == undefined) {
        operations.push({
          op: 'add',
          path: `/extension/${existingVisitStatusExtIdx}/extension/${index}/extension/1/valuePeriod/end`,
          value: dateTimeISO ?? DateTime.now().setZone('UTC').toISO(),
        });
      }
    } else if (period.end == undefined) {
      // the code we're setting is already the current status, so nothing needs to be done
      needsInsert = false;
    }
  });

  if (needsInsert) {
    operations.push({
      op: 'add',
      path: `/extension/${existingVisitStatusExtIdx}/extension/-`,
      value: makeOtherEHRVisitStatusExtensionEntry(statusCode, dateTimeISO),
    });
  }
  return operations;
};
export interface VisitStatusHistoryEntry {
  status: OtherEHRVisitStatus;
  label: OtherEHRVisitStatus;
  period: Period;
}
const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
const visitStatusExtensionCode = 'visit-history';

export const visitStatusExtensionUrl = `${PRIVATE_EXTENSION_BASE_URL}/${visitStatusExtensionCode}`;
export const getVisitStatusHistory = <T extends AppOrEncounter>(resource: T): VisitStatusHistoryEntry[] => {
  const extensions = (resource.extension ?? []).find((ext) => ext.url === visitStatusExtensionUrl)?.extension ?? [];
  const history = extensions.map((ext) => {
    const reduced: VisitStatusHistoryEntry = (ext.extension ?? []).reduce(
      (accum, currentExt) => {
        if (currentExt.url === 'status') {
          accum.status = currentExt.valueString as OtherEHRVisitStatus;
          accum.label = accum.status ?? 'unknown';
        } else {
          accum.period = currentExt.valuePeriod as Period;
        }
        return accum;
      },
      { status: '', period: {}, label: '' } as unknown as VisitStatusHistoryEntry,
    );
    return reduced;
  });

  const filtered = history.filter((entry) => {
    const { status, period, label } = entry;
    return `${status}` !== '' && period.start != undefined;
  });
  return filtered;
};

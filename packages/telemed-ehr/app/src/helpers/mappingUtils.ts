import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Period } from 'fhir/r4';
import { DateTime } from 'luxon';

export const ZAPEHR_ID_TYPE = 'ZapEHR ID';

export const STATI = [
  'arrived',
  'cancelled',
  'intake',
  'no-show',
  'pending',
  'provider',
  'ready',
  'checked-out',
  'discharge',
  'provider-ready',
  'unknown',
] as const;
type STATI_LIST = typeof STATI;
export type VisitStatus = STATI_LIST[number];
export type VISIT_STATUS_LABEL_TYPE = typeof STATI;
export type StatusLabel = VISIT_STATUS_LABEL_TYPE[number];

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

const VisitStatusExtensionUrl = 'https://fhir.zapehr.com/r4/StructureDefinitions/visit-history';
export type VisitStatusExtensionEntry = {
  url: 'status';
  extension: [{ url: 'status'; valueString: VisitStatus }, { url: 'period'; valuePeriod: Period }];
};
export type VisitStatusExtension = {
  url: string;
  extension: VisitStatusExtensionEntry[];
};

export type VisitStatusWithoutUnknown = Exclude<VisitStatus, 'unknown'>;
const otherEHRToFhirAppointmentStatusMap: Record<VisitStatusWithoutUnknown, AppointmentStatus> = {
  pending: 'booked',
  arrived: 'arrived',
  ready: 'checked-in',
  intake: 'checked-in',
  'provider-ready': 'fulfilled',
  provider: 'fulfilled',
  discharge: 'fulfilled',
  'checked-out': 'fulfilled',
  cancelled: 'cancelled',
  'no-show': 'noshow',
};

export function makeVisitStatusExtensionEntry(
  statusCode: VisitStatus,
  dateTimeISO?: string,
): VisitStatusExtensionEntry {
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

export const mapVisitStatusToFhirAppointmentStatus = (
  TelemedAppointmentStatus: VisitStatusWithoutUnknown,
): AppointmentStatus => {
  return otherEHRToFhirAppointmentStatusMap[TelemedAppointmentStatus] ?? 'proposed'; // 'fulfilled' maybe?
};

const otherEHRToFhirEncounterStatusMap: Record<VisitStatusWithoutUnknown, EncounterStatus> = {
  pending: 'planned',
  arrived: 'arrived',
  ready: 'arrived',
  intake: 'arrived',
  'provider-ready': 'arrived',
  provider: 'in-progress',
  discharge: 'in-progress',
  'checked-out': 'finished',
  cancelled: 'cancelled',
  'no-show': 'cancelled',
};

export const mapVisitStatusToFhirEncounterStatus = (
  TelemedAppointmentStatus: VisitStatusWithoutUnknown,
): EncounterStatus => {
  return otherEHRToFhirEncounterStatusMap[TelemedAppointmentStatus] ?? 'unknown';
};

type AppOrEncounter = Appointment | Encounter;
export const getPatchOperationsToUpdateVisitStatus = <T extends AppOrEncounter>(
  resource: T,
  statusCode: VisitStatus,
  dateTimeISO?: string,
): Operation[] => {
  if (resource.extension == undefined) {
    return [
      {
        op: 'add',
        path: '/extension',
        value: [makeVisitStatusExtensionEntry(statusCode, dateTimeISO)],
      },
    ];
  }
  const extensions = resource.extension ?? [];
  const existingVisitStatusExtIdx = extensions.findIndex((ext) => ext.url === VisitStatusExtensionUrl);
  if (existingVisitStatusExtIdx === -1) {
    return [
      {
        op: 'add',
        path: '/extension/-',
        value: makeVisitStatusExtensionEntry(statusCode, dateTimeISO),
      },
    ];
  }
  const existingVisitStatusExt = extensions[existingVisitStatusExtIdx] as VisitStatusExtension;
  const statusList = existingVisitStatusExt.extension;
  if (statusList == undefined) {
    return [
      {
        op: 'add',
        path: `/extension/${existingVisitStatusExtIdx}/extension`,
        value: makeVisitStatusExtensionEntry(statusCode, dateTimeISO).extension,
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
      value: makeVisitStatusExtensionEntry(statusCode, dateTimeISO),
    });
  }
  return operations;
};
export interface VisitStatusHistoryEntry {
  status: VisitStatus;
  label: VisitStatus;
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
          accum.status = currentExt.valueString as VisitStatus;
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

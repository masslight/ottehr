import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Location, Period, Questionnaire } from 'fhir/r4';
import { DateTime } from 'luxon';
import { Secrets, SecretsKeys, getSecret } from 'ottehr-utils';

export const ZAPEHR_ID_TYPE = 'ZapEHR ID';

const STATI = [
  'ARRIVED',
  'CANCELLED',
  'CHECKED-IN',
  'INTAKE',
  'NO-SHOW',
  'PENDING',
  'PROVIDER',
  'READY',
  'DISCHARGE',
  'PROVIDER-READY',
];
type STATI_LIST = typeof STATI;
export type VisitStatus = STATI_LIST[number];

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

export type VisitStatusExtensionEntry = {
  url: 'status';
  extension: [{ url: 'status'; valueString: VisitStatus }, { url: 'period'; valuePeriod: Period }];
};
export type VisitStatusExtension = {
  url: string;
  extension: VisitStatusExtensionEntry[];
};

const otherEHRToFhirAppointmentStatusMap: Record<VisitStatus, AppointmentStatus> = {
  PENDING: 'booked',
  ARRIVED: 'arrived',
  READY: 'checked-in',
  INTAKE: 'checked-in',
  'PROVIDER-READY': 'fulfilled',
  PROVIDER: 'fulfilled',
  DISCHARGE: 'fulfilled',
  'CHECKED-IN': 'fulfilled',
  CANCELLED: 'cancelled',
  'NO-SHOW': 'noshow',
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

const VisitStatusExtensionUrl = `https://fhir.zapehr.com/r4/StructureDefinitions/visit-history`;
export const makeVisitStatusExtension = (
  statusCode: VisitStatus,
  dateTimeISO?: string,
): VisitStatusExtension => {
  return {
    url: VisitStatusExtensionUrl,
    extension: [makeVisitStatusExtensionEntry(statusCode, dateTimeISO)],
  };
};

export const mapVisitStatusToFhirAppointmentStatus = (apptStatus: VisitStatus): AppointmentStatus => {
  return otherEHRToFhirAppointmentStatusMap[apptStatus] ?? 'proposed'; // 'fulfilled' maybe?
};

const otherEHRToFhirEncounterStatusMap: Record<VisitStatus, EncounterStatus> = {
  PENDING: 'planned',
  ARRIVED: 'arrived',
  READY: 'arrived',
  INTAKE: 'arrived',
  'PROVIDER-READY': 'arrived',
  PROVIDER: 'in-progress',
  DISCHARGE: 'in-progress',
  'CHECKED-IN': 'finished',
  CANCELLED: 'cancelled',
  'NO-SHOW': 'cancelled',
};

export const mapVisitStatusToFhirEncounterStatus = (apptStatus: VisitStatus): EncounterStatus => {
  return otherEHRToFhirEncounterStatusMap[apptStatus] ?? 'unknown';
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

export const validateVisitStatus = (
  visitStatus: string | undefined,
  secrets: Secrets | null,
): VisitStatus => {
  console.log('validating otherehr visit status', visitStatus);
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  if (!ENVIRONMENT) {
    console.log('secrets not defined');
    throw new Error('Secrets not defined');
  }

  if (!visitStatus) {
    throw new Error('Unexpectedly found no value for Visit.status on visit record');
  }

  // Translation variables
  if (!STATI.includes(visitStatus as VisitStatus)) {
    throw new Error(`Unrecognized value found for Visit.status on visit record: ${visitStatus}`);
  }
  return visitStatus as VisitStatus;
};

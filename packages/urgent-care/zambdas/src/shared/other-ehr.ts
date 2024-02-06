import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Location, Period, Questionnaire } from 'fhir/r4';
import { DateTime } from 'luxon';
import { Secrets, SecretsKeys, getSecret } from 'utils';

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

export type OtherEHRVisitStatusExtensionEntry = {
  url: 'status';
  extension: [{ url: 'status'; valueString: OtherEHRVisitStatus }, { url: 'period'; valuePeriod: Period }];
};
export type OtherEHRVisitStatusExtension = {
  url: string;
  extension: OtherEHRVisitStatusExtensionEntry[];
};

const otherEHRToFhirAppointmentStatusMap: Record<OtherEHRVisitStatus, AppointmentStatus> = {
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

const otherEHRVisitStatusExtensionUrl = `https://fhir.zapehr.com/r4/StructureDefinitions/visit-history`;
export const makeOtherEHRVisitStatusExtension = (
  statusCode: OtherEHRVisitStatus,
  dateTimeISO?: string,
): OtherEHRVisitStatusExtension => {
  return {
    url: otherEHRVisitStatusExtensionUrl,
    extension: [makeOtherEHRVisitStatusExtensionEntry(statusCode, dateTimeISO)],
  };
};

export const mapOtherEHRVisitStatusToFhirAppointmentStatus = (apptStatus: OtherEHRVisitStatus): AppointmentStatus => {
  return otherEHRToFhirAppointmentStatusMap[apptStatus] ?? 'proposed'; // 'fulfilled' maybe?
};

const otherEHRToFhirEncounterStatusMap: Record<OtherEHRVisitStatus, EncounterStatus> = {
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

export const mapOtherEHRVisitStatusToFhirEncounterStatus = (apptStatus: OtherEHRVisitStatus): EncounterStatus => {
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

export const validateOtherEHRVisitStatus = (
  visitStatus: string | undefined,
  secrets: Secrets | null,
): OtherEHRVisitStatus => {
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
  if (!STATI.includes(visitStatus as OtherEHRVisitStatus)) {
    throw new Error(`Unrecognized value found for Visit.status on visit record: ${visitStatus}`);
  }
  return visitStatus as OtherEHRVisitStatus;
};

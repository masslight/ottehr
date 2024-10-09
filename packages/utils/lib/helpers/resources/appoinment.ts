import { FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Period } from 'fhir/r4';
import { DateTime } from 'luxon';

export async function getAppointmentResourceById(
  appointmentID: string,
  fhirClient: FhirClient
): Promise<Appointment | undefined> {
  let response: Appointment | null = null;
  try {
    response = await fhirClient.readResource<Appointment>({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}


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

export type VisitStatusExtensionEntry = {
  url: 'status';
  extension: [{ url: 'status'; valueString: VisitStatus }, { url: 'period'; valuePeriod: Period }];
};

const VisitStatusExtensionUrl = `https://fhir.zapehr.com/r4/StructureDefinitions/visit-history`;

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
export type VisitStatusExtension = {
  url: string;
  extension: VisitStatusExtensionEntry[];
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

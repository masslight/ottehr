import { Appointment, Encounter, Period } from 'fhir/r4';
import { DateTime } from 'luxon';

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

type VISIT_STATUS_LABEL_TYPE = typeof STATI;
export type VisitStatus = VISIT_STATUS_LABEL_TYPE[number];

export const getStatusLabelForAppointmentAndEncounter = (appointment: Appointment): VisitStatus => {
  const statusToMap = getStatusFromExtension(appointment);
  console.log('statusToMap', statusToMap);
  if (statusToMap == undefined) {
    console.log(
      `Unable to derive Visit status from ${
        appointment.status === 'fulfilled' ? 'Encounter' : 'Appointment'
      } because the status has not been added to extensions yet`,
    );
    return 'unknown';
  }
  return statusToMap;
};

const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
const visitStatusExtensionCode = 'visit-history';
export const visitStatusExtensionUrl = `${PRIVATE_EXTENSION_BASE_URL}/${visitStatusExtensionCode}`;

const getStatusFromExtension = (resource: Appointment): VisitStatus | undefined => {
  const history = getVisitStatusHistory(resource);
  if (history) {
    const historySorted = [...history]
      .filter((item) => item.period.end == undefined)
      .sort((h1, h2) => {
        const start1 = h1.period.start;
        const start2 = h2.period.start;
        if (start1 && !start2) {
          return -1;
        }
        if (start2 && !start1) {
          return 1;
        }
        if (!start1 && !start2) {
          return 0;
        }
        const date1 = DateTime.fromISO(start1 as string).toMillis();
        const date2 = DateTime.fromISO(start2 as string).toMillis();
        return date1 - date2;
      });

    return historySorted.pop()?.status;
  }
  return undefined;
};
export interface VisitStatusHistoryEntry {
  status: VisitStatus;
  label: string;
  period: Period;
}
type AppOrEncounter = Appointment | Encounter;
export const getVisitStatusHistory = <T extends AppOrEncounter>(resource: T): VisitStatusHistoryEntry[] => {
  const extensions = (resource.extension ?? []).find((ext) => ext.url === visitStatusExtensionUrl)?.extension ?? [];
  const history = extensions.map((ext) => {
    console.log(2, ext);
    const reduced: VisitStatusHistoryEntry = (ext.extension ?? []).reduce(
      (accum, currentExt) => {
        console.log(1, currentExt);
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
    return `${status}` !== '' && period.start != undefined && label !== '';
  });
  return filtered;
};

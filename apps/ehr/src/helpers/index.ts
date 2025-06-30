import Oystehr from '@oystehr/sdk';
import { Message } from '@twilio/conversations';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Location, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ApptTab } from 'src/components/AppointmentTabs';
import { getEncounterStatusHistoryUpdateOp, getPatchBinary, InPersonAppointmentInformation, PROJECT_NAME } from 'utils';
import { EvolveUser } from '../hooks/useEvolveUser';
import { CRITICAL_CHANGE_SYSTEM } from './activityLogsUtils';
import { getCriticalUpdateTagOp } from './activityLogsUtils';
import { formatDateUsingSlashes, getTimezone } from './formatDateTime';

export const classifyAppointments = (appointments: InPersonAppointmentInformation[]): Map<any, any> => {
  const statusCounts = new Map();

  appointments.forEach((appointment) => {
    const { status } = appointment;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  return statusCounts;
};

export const messageIsFromPatient = (message: Message): boolean => {
  return message.author?.startsWith('+') ?? false;
};

const getCheckInNeededTagsPatchOperation = (appointment: Appointment, user: EvolveUser | undefined): Operation => {
  const criticalUpdateTagCoding = {
    system: CRITICAL_CHANGE_SYSTEM,
    display: `Staff ${user?.email ? user.email : `(${user?.id})`}`,
    version: DateTime.now().toISO() || '',
  };

  const meta = appointment.meta;
  if (meta) {
    let op: 'add' | 'replace' = 'add';
    const value = (meta.tag ?? []).filter((coding) => coding.system !== CRITICAL_CHANGE_SYSTEM);
    if (meta.tag != undefined) {
      op = 'replace';
    }
    value.push(criticalUpdateTagCoding);
    return {
      op,
      path: '/meta/tag',
      value,
    };
  } else {
    const value = { tag: [criticalUpdateTagCoding] };
    return {
      op: 'add',
      path: '/meta',
      value,
    };
  }
};

export const checkInPatient = async (
  oystehr: Oystehr,
  appointmentId: string,
  encounterId: string,
  user: EvolveUser | undefined
): Promise<void> => {
  const appointmentToUpdate = await oystehr.fhir.get<Appointment>({
    resourceType: 'Appointment',
    id: appointmentId,
  });
  const encounterToUpdate = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });
  const metaPatchOperation = getCheckInNeededTagsPatchOperation(appointmentToUpdate, user);

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(encounterToUpdate, 'arrived');

  const patchOp: Operation = {
    op: 'replace',
    path: '/status',
    value: 'arrived',
  };

  await oystehr.fhir.batch({
    requests: [
      getPatchBinary({
        resourceId: appointmentId,
        resourceType: 'Appointment',
        patchOperations: [patchOp, metaPatchOperation],
      }),
      getPatchBinary({
        resourceId: encounterId,
        resourceType: 'Encounter',
        patchOperations: [patchOp, encounterStatusHistoryUpdate],
      }),
    ],
  });
};

export interface LocationOptionConfig {
  label: string;
  value: string;
}

export const sortLocationsByLabel = (locations: LocationOptionConfig[]): { label: string; value: string }[] => {
  function compare(a: { label: string; value: string }, b: { label: string; value: string }): number {
    const labelA = a.label.toUpperCase();
    const labelB = b.label.toUpperCase();

    if (labelA < labelB) {
      return -1;
    }
    if (labelA > labelB) {
      return 1;
    }
    return 0;
  }

  locations.sort(compare);

  return locations;
};

export const formatLastModifiedTag = (
  field: string,
  resource: Resource | undefined,
  location: Location
): string | undefined => {
  if (!resource) return;
  const codeString = resource?.meta?.tag?.find((tag) => tag.system === `staff-update-history-${field}`)?.code;
  if (codeString) {
    const locationTimeZone = getTimezone(location);
    const codeJson = JSON.parse(codeString) as any;
    const date = DateTime.fromISO(codeJson.lastModifiedDate).setZone(locationTimeZone);
    const timeFormatted = date.toLocaleString(DateTime.TIME_SIMPLE);
    const dateFormatted = formatDateUsingSlashes(date.toISO() || '');
    const timezone = date.offsetNameShort;
    return `${dateFormatted} ${timeFormatted} ${timezone ?? ''} By ${codeJson.lastModifiedBy}`;
  }
  return;
};

export const patchAppointmentComment = async (
  appointment: InPersonAppointmentInformation | Appointment,
  comment: string,
  user: EvolveUser | undefined,
  oystehr: Oystehr
): Promise<Appointment | undefined> => {
  if (!appointment || !appointment.id) {
    return;
  }

  let patchOp: 'replace' | 'add' | 'remove';
  const patchOperations = [];
  if (comment !== '') {
    patchOp = appointment.comment ? 'replace' : 'add';
    patchOperations.push({ op: patchOp, path: '/comment', value: comment });
  } else {
    patchOp = 'remove';
    patchOperations.push({ op: patchOp, path: '/comment' });
  }
  const fhirAppointment = await oystehr.fhir.get<Appointment>({
    resourceType: 'Appointment',
    id: appointment.id,
  });
  const updateTag = getCriticalUpdateTagOp(fhirAppointment, user?.name || `${PROJECT_NAME} Team Member (${user?.id})`);
  patchOperations.push(updateTag);
  console.log('patchOperations', patchOperations);
  const updatedAppointment = await oystehr.fhir.patch<Appointment>({
    resourceType: 'Appointment',
    id: appointment.id,
    operations: patchOperations,
  });
  return updatedAppointment;
};

// there are two different tooltips that are show on the tracking board depending which tab/section you are on
// 1. visit components on prebooked, in-office/waiting and cancelled
// 2. orders on in-office/in-exam and completed
export const displayOrdersToolTip = (appointment: InPersonAppointmentInformation, tab: ApptTab): boolean => {
  let display = false;
  if (tab === ApptTab.completed) {
    display = true;
  } else if (tab === ApptTab['in-office'] && appointment.status !== 'arrived' && appointment.status !== 'ready') {
    // in exam
    display = true;
  }
  return display;
};

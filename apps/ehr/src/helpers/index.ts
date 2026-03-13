import Oystehr from '@oystehr/sdk';
import { Message } from '@twilio/conversations';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ApptTab } from 'src/components/AppointmentTabs';
import {
  BRANDING_CONFIG,
  formatDateForDisplay,
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  getPractitionerNPIIdentifier,
  InPersonAppointmentInformation,
  isPhysician,
  isPhysicianProviderType,
  OrdersForTrackingBoardRow,
  ProviderTypeCode,
} from 'utils';
import { EvolveUser } from '../hooks/useEvolveUser';
import { getCriticalUpdateTagOp } from './activityLogsUtils';

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
  const checkedInBy = `Staff ${user?.email ? user.email : `(${user?.id})`}`;
  const metaPatchOperations = getAppointmentMetaTagOpForStatusUpdate(appointmentToUpdate, 'arrived', {
    updatedByOverride: checkedInBy,
  });

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    encounterToUpdate,
    'arrived',
    'arrived'
  );

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
        patchOperations: [patchOp, ...metaPatchOperations],
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
  locationTimeZone: string | undefined
): string | undefined => {
  if (!resource) return;
  const codeString = resource?.meta?.tag?.find((tag) => tag.system === `staff-update-history-${field}`)?.code;
  if (codeString) {
    const codeJson = JSON.parse(codeString) as any;
    const date = DateTime.fromISO(codeJson.lastModifiedDate).setZone(locationTimeZone);
    const timeFormatted = date.toLocaleString(DateTime.TIME_SIMPLE);
    const dateFormatted = formatDateForDisplay(date.toISO() || '');
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
  const updateTag = getCriticalUpdateTagOp(
    fhirAppointment,
    user?.name || `${BRANDING_CONFIG.projectName} Team Member (${user?.id})`
  );
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

export const hasAtLeastOneOrder = (orders: OrdersForTrackingBoardRow): boolean => {
  return Object.values(orders).some((orderList) => Array.isArray(orderList) && orderList.length > 0);
};

export function isEligibleSupervisor(practitioner: Practitioner, attenderProviderType?: ProviderTypeCode): boolean {
  if (!practitioner) return false;

  const isAttenderPhysician = isPhysicianProviderType(attenderProviderType);
  const isPractitionerPhysician = isPhysician(practitioner);
  const npiIdentifier = getPractitionerNPIIdentifier(practitioner);

  return !isAttenderPhysician && isPractitionerPhysician && Boolean(npiIdentifier?.value);
}

export function sortByRecencyAndStatus<T extends { lastUpdated?: string; current?: boolean }>(
  items: T[] = [],
  newestFirst = false
): T[] {
  const sortedByTime = [...items].sort((a, b) => {
    const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return newestFirst ? bTime - aTime : aTime - bTime;
  });

  const active: T[] = [];
  const inactive: T[] = [];

  sortedByTime.forEach((item) => {
    (item.current ? active : inactive).push(item);
  });

  return [...active, ...inactive];
}

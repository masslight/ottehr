import { Message } from '@twilio/conversations';
import { FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Location, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { formatDateUsingSlashes, getTimezone } from '../helpers/formatDateTime';
import { lastModifiedCode } from '../types/types';
import { UCAppointmentInformation, User, getPatchOperationForNewMetaTag } from 'ehr-utils';

export const classifyAppointments = (appointments: UCAppointmentInformation[]): Map<any, any> => {
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

export const checkinPatient = async (fhirClient: FhirClient, appointmentId: string): Promise<void> => {
  const appointmentToUpdate = await fhirClient.readResource<Appointment>({
    resourceType: 'Appointment',
    resourceId: appointmentId,
  });

  await fhirClient.patchResource({
    resourceType: 'Appointment',
    resourceId: appointmentId,
    operations: [
      {
        op: 'replace',
        path: '/extension/0/extension/0/extension/0/valueString',
        value: 'arrived',
      },
      {
        op: 'replace',
        path: '/extension/0/extension/0/extension/1/valuePeriod/start',
        value: new Date().toISOString(),
      },
    ],
  });
};

export const sortLocationsByLabel = (
  locations: { label: string; value: string }[],
): { label: string; value: string }[] => {
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
  location: Location,
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

export const getUpdateTagOperation = (resource: Resource, field: string, user: User | undefined): Operation => {
  const updateCode: lastModifiedCode = {
    lastModifiedDate: DateTime.now(),
    lastModifiedBy: user?.name || 'PM Team Member',
    lastModifiedByID: user?.id,
  };
  const staffUpdateTagOp = getPatchOperationForNewMetaTag(resource, {
    system: `staff-update-history-${field}`,
    code: JSON.stringify(updateCode),
  });
  return staffUpdateTagOp;
};

import Oystehr from '@oystehr/sdk';
import { Appointment, CodeableConcept, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentType,
  diffInMinutes,
  EncounterVirtualServiceExtension,
  FHIR_APPOINTMENT_TYPE_MAP,
  OTTEHR_MODULE,
  PUBLIC_EXTENSION_BASE_URL,
  TELEMED_VIDEO_ROOM_CODE,
  TelemedAppointmentStatusEnum,
  TelemedStatusHistoryElement,
} from 'utils';

export async function cancelAppointmentResource(
  appointment: Appointment,
  cancellationReasonCoding: NonNullable<CodeableConcept['coding']>,
  oystehr: Oystehr
): Promise<Appointment> {
  if (!appointment.id) {
    throw Error('Appointment resource missing id');
  }

  try {
    const response: Appointment = await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: appointment.id,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
        {
          op: 'add',
          path: '/cancelationReason',
          value: {
            coding: cancellationReasonCoding,
          },
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to cancel Appointment: ${JSON.stringify(error)}`);
  }
}

export const isAppointmentVirtual = (appointment: Appointment): boolean => {
  return appointment.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM) || false;
};

export const getAppointmentWaitingTime = (statuses?: TelemedStatusHistoryElement[]): number | undefined => {
  if (!statuses) {
    return undefined;
  }

  const onVideoIndex = statuses?.findIndex((status) => status.status === TelemedAppointmentStatusEnum['on-video']);

  const statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);

  const start = statusesToWait.at(0)?.start;
  const end = statusesToWait.at(-1)?.end;

  if (!start)
    throw new Error(
      `Can't getAppointmentWaitingTime because start time of ${JSON.stringify(statusesToWait.at(0))} status is empty`
    );
  return end
    ? diffInMinutes(DateTime.fromISO(end), DateTime.fromISO(start))
    : diffInMinutes(DateTime.now(), DateTime.fromISO(start));
};

export async function getAppointmentResourceById(
  appointmentID: string,
  oystehr: Oystehr
): Promise<Appointment | undefined> {
  let response: Appointment | null = null;
  try {
    response = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentID,
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

export const getVirtualServiceResourceExtension = (
  resource: Appointment | Encounter,
  code: typeof TELEMED_VIDEO_ROOM_CODE | 'twilio-conversations'
): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  if (resource.resourceType === 'Appointment') {
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (resource.extension?.length ?? 0); index++) {
    const extension = resource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension?.valueCoding?.code === code) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const appointmentTypeForAppointment = (appointment: Appointment): AppointmentType => {
  // might as well default to walkin here
  // console.log('FHIR_APPOINTMENT_TYPE_MAP', FHIR_APPOINTMENT_TYPE_MAP, appointment.appointmentType?.text);
  return appointment.appointmentType?.text
    ? FHIR_APPOINTMENT_TYPE_MAP[appointment.appointmentType?.text] || 'walk-in'
    : 'walk-in';
};

import { Appointment, Encounter, Resource } from 'fhir/r4';
import {
  EncounterVirtualServiceExtension,
  PUBLIC_EXTENSION_BASE_URL,
  TELEMED_VIDEO_ROOM_CODE,
  TelemedAppointmentStatus,
  TelemedAppointmentStatusEnum,
} from 'ottehr-utils';

export const getVideoRoomResourceExtension = (resource: Resource): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  let castedResource;
  if (resource.resourceType === 'Appointment') {
    castedResource = resource as Appointment;
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    castedResource = resource as Encounter;
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (castedResource.extension?.length ?? 0); index++) {
    const extension = castedResource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension.valueCoding?.code === TELEMED_VIDEO_ROOM_CODE) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined,
): TelemedAppointmentStatus | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return TelemedAppointmentStatusEnum.ready;
    case 'arrived':
      return TelemedAppointmentStatusEnum['pre-video'];
    case 'in-progress':
      return TelemedAppointmentStatusEnum['on-video'];
    case 'cancelled':
      return TelemedAppointmentStatusEnum['cancelled'];
    case 'finished':
      if (appointmentStatus === 'fulfilled') return TelemedAppointmentStatusEnum.complete;
      else return TelemedAppointmentStatusEnum.unsigned;
  }
  return undefined;
};

export const removePrefix = (prefix: string, text: string): string | undefined => {
  return text.includes(prefix) ? text.replace(prefix, '') : undefined;
};

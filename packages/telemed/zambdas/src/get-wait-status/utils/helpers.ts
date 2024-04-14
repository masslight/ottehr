import { Location } from 'fhir/r4';

export type TelemedCallStatuses = 'ready' | 'pre-video' | 'on-video' | 'unsigned' | 'complete';

export const isLocationVirtual = (location: Location): boolean => {
  return location.extension?.[0].valueCoding?.code === 'vi';
};

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined,
): TelemedCallStatuses | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return 'ready';
    case 'arrived':
      return 'pre-video';
    case 'in-progress':
      return 'on-video';
    case 'finished':
      if (appointmentStatus === 'fulfilled') return 'complete';
      else return 'unsigned';
  }
  return undefined;
};

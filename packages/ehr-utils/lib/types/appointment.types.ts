export type AppointmentType = 'now' | 'prebook';

export enum TelemedAppointmentStatus {
  'ready' = 'ready',
  'pre-video' = 'pre-video',
  'on-video' = 'on-video',
  'unsigned' = 'unsigned',
  'complete' = 'complete',
  'cancelled' = 'cancelled',
}

export type TelemedCallStatuses = `${TelemedAppointmentStatus}`;
export const TelemedCallStatusesArr = ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'];

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined,
): TelemedAppointmentStatus | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return TelemedAppointmentStatus.ready;
    case 'arrived':
      return TelemedAppointmentStatus['pre-video'];
    case 'in-progress':
      return TelemedAppointmentStatus['on-video'];
    case 'finished':
      if (appointmentStatus === 'fulfilled') return TelemedAppointmentStatus.complete;
      else return TelemedAppointmentStatus.unsigned;
  }
  return undefined;
};

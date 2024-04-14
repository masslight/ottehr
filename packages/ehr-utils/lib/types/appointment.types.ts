export enum ApptStatus {
  'ready' = 'ready',
  'pre-video' = 'pre-video',
  'on-video' = 'on-video',
  'unsigned' = 'unsigned',
  'complete' = 'complete',
}

export type TelemedCallStatuses = `${ApptStatus}`;
export const TelemedCallStatusesArr = ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'];

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined,
): ApptStatus | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return ApptStatus.ready;
    case 'arrived':
      return ApptStatus['pre-video'];
    case 'in-progress':
      return ApptStatus['on-video'];
    case 'finished':
      if (appointmentStatus === 'fulfilled') return ApptStatus.complete;
      else return ApptStatus.unsigned;
  }
  return undefined;
};

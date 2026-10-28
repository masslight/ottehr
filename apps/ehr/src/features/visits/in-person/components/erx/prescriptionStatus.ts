import { DateTime } from 'luxon';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

export type PrescriptionChip = 'Sending' | 'Sent' | 'Error' | 'Cancel requested' | 'Cancelled';

const CANCEL_EVENT_CODES = ['cancelrequested', 'cancelled', 'canceldenied'];

const eventDate = (event: ErxEventDTO): string =>
  event.recorded ? ` ${DateTime.fromISO(event.recorded).toLocal().toFormat('MM/dd')}` : '';

// The pharmacy's fill and request events, in plain words
const FILL_EVENT_TEXT: Record<string, (event: ErxEventDTO) => string> = {
  dispensed: (event) => `Dispensed${eventDate(event)}`,
  partiallydispensed: (event) => `Partially dispensed${eventDate(event)}`,
  notdispensed: () => 'Not dispensed',
  transferred: () => 'Transferred',
  renewalrequested: () => 'Refill requested by the pharmacy',
  changerequested: () => 'Change requested by the pharmacy',
};

const latestEvent = (
  prescription: PrescribedMedicationDTO,
  matches: (event: ErxEventDTO) => boolean
): ErxEventDTO | undefined => prescription.events?.filter(matches).at(-1);

// The reason follows a fixed prefix in the eRx service's event text.
const textAfter = (text: string | undefined, prefix: string): string | undefined =>
  text?.startsWith(prefix) ? text.slice(prefix.length).trim() || undefined : undefined;

/** The status chip and the latest event under it; no chip for a status the eRx service doesn't set. */
export const prescriptionStatusView = (
  prescription: PrescribedMedicationDTO
): { chip?: PrescriptionChip; detail?: string } => {
  switch (prescription.status) {
    case 'draft':
      return { chip: 'Sending', detail: 'Waiting for Surescripts' };
    case 'stopped':
      return { chip: 'Error', detail: latestEvent(prescription, (event) => event.code.startsWith('error'))?.text };
    case 'cancelled':
      return { chip: 'Cancelled', detail: 'Confirmed by the pharmacy' };
    case 'active': {
      const cancelEvent = latestEvent(prescription, (event) => CANCEL_EVENT_CODES.includes(event.code));
      if (cancelEvent?.code === 'cancelrequested') {
        const reason = textAfter(cancelEvent.text, 'Cancellation requested with reason:');
        return {
          chip: 'Cancel requested',
          detail: [reason, 'waiting for the pharmacy'].filter(Boolean).join(' · '),
        };
      }
      if (cancelEvent?.code === 'canceldenied') {
        const reason = textAfter(cancelEvent.text, 'Cancellation denied by pharmacy:');
        return { chip: 'Sent', detail: reason ? `Cancel denied: ${reason}` : 'Cancel denied' };
      }
      const fillEvent = latestEvent(prescription, (event) => event.code in FILL_EVENT_TEXT);
      return { chip: 'Sent', detail: fillEvent && FILL_EVENT_TEXT[fillEvent.code](fillEvent) };
    }
    default:
      return {};
  }
};

/** The eRx service cancels only an active prescription, and only once: never after any earlier request. */
export const isPrescriptionCancellable = (prescription: PrescribedMedicationDTO): boolean =>
  prescription.status === 'active' && !prescription.events?.some((event) => event.code === 'cancelrequested');

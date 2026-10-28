import { DateTime } from 'luxon';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import {
  isPrescriptionCancellable,
  prescriptionStatusView,
} from '../../src/features/visits/in-person/components/erx/prescriptionStatus';

const DISPENSED_AT = '2026-10-27T16:00:00.000Z';
const ordered: ErxEventDTO = { code: 'ordered', recorded: '2026-10-27T15:00:00.000Z' };
const accepted: ErxEventDTO = { code: 'accepted', recorded: '2026-10-27T15:01:00.000Z' };
const event = (code: string, text?: string, recorded = '2026-10-27T17:00:00.000Z'): ErxEventDTO => ({
  code,
  text,
  recorded,
});
const cancelRequested = event('cancelrequested', 'Cancellation requested with reason: Sent in error');
const rx = (status: PrescribedMedicationDTO['status'], ...events: ErxEventDTO[]): PrescribedMedicationDTO => ({
  resourceId: 'rx-1',
  status,
  events: [ordered, ...events],
});

describe('prescription status chip and latest event', () => {
  it.each([
    ['sending', rx('draft'), { chip: 'Sending', detail: 'Waiting for Surescripts' }],
    [
      'error',
      rx('stopped', event('error 601', 'Surescripts reported an error: Receiver unable to process')),
      { chip: 'Error', detail: 'Surescripts reported an error: Receiver unable to process' },
    ],
    [
      'cancel requested',
      rx('active', accepted, cancelRequested),
      { chip: 'Cancel requested', detail: 'Sent in error · waiting for the pharmacy' },
    ],
    [
      'cancelled',
      rx('cancelled', accepted, cancelRequested, event('cancelled', 'Cancellation confirmed by pharmacy')),
      { chip: 'Cancelled', detail: 'Confirmed by the pharmacy' },
    ],
    [
      'cancel denied',
      rx(
        'active',
        accepted,
        cancelRequested,
        event('canceldenied', 'Cancellation denied by pharmacy: Already picked up')
      ),
      { chip: 'Sent', detail: 'Cancel denied: Already picked up' },
    ],
    ['sent', rx('active', accepted), { chip: 'Sent', detail: undefined }],
    [
      'dispensed',
      rx('active', accepted, event('dispensed', undefined, DISPENSED_AT)),
      { chip: 'Sent', detail: `Dispensed ${DateTime.fromISO(DISPENSED_AT).toFormat('MM/dd')}` },
    ],
    [
      'partially dispensed',
      rx('active', accepted, event('partiallydispensed', undefined, DISPENSED_AT)),
      { chip: 'Sent', detail: `Partially dispensed ${DateTime.fromISO(DISPENSED_AT).toFormat('MM/dd')}` },
    ],
    ['not dispensed', rx('active', accepted, event('notdispensed')), { chip: 'Sent', detail: 'Not dispensed' }],
    ['transferred', rx('active', accepted, event('transferred')), { chip: 'Sent', detail: 'Transferred' }],
    [
      'renewal requested, after a dispense',
      rx('active', accepted, event('dispensed', undefined, DISPENSED_AT), event('renewalrequested')),
      { chip: 'Sent', detail: 'Refill requested by the pharmacy' },
    ],
    [
      'change requested',
      rx('active', accepted, event('changerequested')),
      { chip: 'Sent', detail: 'Change requested by the pharmacy' },
    ],
    ['a status the eRx service does not set', rx('completed'), {}],
  ])('%s', (_name, prescription, expected) => {
    expect(prescriptionStatusView(prescription)).toEqual(expected);
  });
});

describe('a prescription can be cancelled', () => {
  it('when it is active and no cancellation was ever requested', () => {
    expect(isPrescriptionCancellable(rx('active', accepted, event('dispensed')))).toBe(true);
    expect(isPrescriptionCancellable(rx('active', accepted, cancelRequested))).toBe(false);
    // The eRx service refuses a second request, even after the pharmacy denied the first.
    expect(isPrescriptionCancellable(rx('active', accepted, cancelRequested, event('canceldenied')))).toBe(false);
    expect(isPrescriptionCancellable(rx('draft'))).toBe(false);
    expect(isPrescriptionCancellable(rx('stopped'))).toBe(false);
    expect(isPrescriptionCancellable(rx('cancelled'))).toBe(false);
  });
});

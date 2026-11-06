import { DateTime } from 'luxon';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import {
  erxEventText,
  isPrescriptionActionAvailable,
  isPrescriptionCancellable,
  prescriptionActionUnavailableText,
  prescriptionStatusView,
  prescriptionToOrderForPharmacy,
} from '../../src/features/visits/in-person/components/erx/prescriptionStatus';

const DISPENSED_AT = '2026-10-27T16:00:00.000Z';
const ordered: ErxEventDTO = { code: 'ordered', recorded: '2026-10-27T15:00:00.000Z' };
const accepted: ErxEventDTO = { code: 'accepted', recorded: '2026-10-27T15:01:00.000Z' };
const event = (code: string, text?: string, recorded = '2026-10-27T17:00:00.000Z'): ErxEventDTO => ({
  code,
  text,
  recorded,
});
const faxed = event('faxed', 'Surescripts faxed the prescription: Receiver unable to process');
const cancelRequested = event('cancelrequested', 'Cancellation requested with reason: Sent in error');
const cancelledWith = (cancelResponse: ErxEventDTO['cancelResponse']): ErxEventDTO => ({
  ...event('cancelled', 'Cancellation confirmed by pharmacy'),
  cancelResponse,
});
const deniedWith: ErxEventDTO = {
  ...event('canceldenied', 'Cancellation denied by pharmacy: Picked up yesterday'),
  cancelResponse: {
    denialReasonCode: { code: 'XX', display: 'Reason code description' },
    denialReason: 'Picked up yesterday',
    priorDispensing: true,
  },
};
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
    [
      'cancelled, with the pharmacy’s note',
      rx('cancelled', accepted, cancelRequested, cancelledWith({ note: 'Patient told', priorDispensing: true })),
      { chip: 'Cancelled', detail: 'Confirmed by the pharmacy · pharmacy note: Patient told · Already dispensed' },
    ],
    [
      'cancel denied, with the reason code’s description, the reason and prior dispensing',
      rx('active', accepted, cancelRequested, deniedWith),
      {
        chip: 'Sent',
        detail: 'Cancel denied: Reason code description; Picked up yesterday; Already dispensed',
      },
    ],
    ['sent by fax', rx('draft', faxed), { chip: 'Sent by fax' }],
    [
      'sent by fax, then dispensed',
      rx('active', faxed, accepted, event('dispensed', undefined, DISPENSED_AT)),
      { chip: 'Sent by fax', detail: `Dispensed ${DateTime.fromISO(DISPENSED_AT).toFormat('MM/dd')}` },
    ],
    ['a status the eRx service does not set', rx('completed'), {}],
  ])('%s', (_name, prescription, expected) => {
    expect(prescriptionStatusView(prescription)).toEqual(expected);
  });
});

describe('the history’s words for an event', () => {
  it('describes a fax after an electronic failure, and keeps the service’s text otherwise', () => {
    expect(erxEventText(faxed)).toBe('Sent by fax after an electronic failure');
    expect(erxEventText(cancelRequested)).toBe('Cancellation requested with reason: Sent in error');
  });

  it('gives the pharmacy’s whole cancel reply', () => {
    expect(erxEventText(deniedWith)).toBe(
      'Cancellation denied by pharmacy: Reason code description; Picked up yesterday; Already dispensed'
    );
    expect(erxEventText(cancelledWith({ note: 'Patient told' }))).toBe(
      'Cancellation confirmed by pharmacy · pharmacy note: Patient told'
    );
    expect(erxEventText(event('canceldenied', 'Cancellation denied by pharmacy: Already picked up'))).toBe(
      'Cancellation denied by pharmacy: Already picked up'
    );
  });
});

describe('a faxed prescription’s actions', () => {
  it('name its status while it waits, and Cancel denied once the pharmacy refused a cancel', () => {
    expect(prescriptionActionUnavailableText('cancel', [rx('draft', faxed)])).toBe(
      "Cancel isn't available for prescriptions with status Sent by fax."
    );
    expect(
      prescriptionActionUnavailableText('cancel', [
        rx('active', faxed, accepted, cancelRequested, event('canceldenied')),
      ])
    ).toBe("Cancel isn't available for prescriptions with status Cancel denied.");
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

describe('a compound can’t be cancelled yet', () => {
  const compound = (status: PrescribedMedicationDTO['status']): PrescribedMedicationDTO => ({
    ...rx(status, accepted),
    name: 'Pain cream',
    order: { compound: { description: 'Pain cream', ingredients: [] } },
  });

  it('blocks Cancel on a sent compound, alone or in a selection with a product', () => {
    expect(isPrescriptionActionAvailable('cancel', rx('active', accepted))).toBe(true);
    expect(isPrescriptionActionAvailable('cancel', compound('active'))).toBe(false);
    expect(prescriptionActionUnavailableText('cancel', [compound('active')])).toBe(
      "Canceling compounds isn't supported yet"
    );
    expect(prescriptionActionUnavailableText('cancel', [rx('active', accepted), compound('active')])).toBe(
      "Canceling compounds isn't supported yet"
    );
  });

  it('blocks sending a sent compound to another pharmacy, which cancels it first, but not resending an errored one', () => {
    expect(prescriptionActionUnavailableText('sendToAnotherPharmacy', [compound('active')])).toBe(
      "Canceling compounds isn't supported yet"
    );
    expect(prescriptionActionUnavailableText('sendToAnotherPharmacy', [compound('stopped')])).not.toContain(
      'Canceling compounds'
    );
  });

  it('names the status first for a compound no action applies to', () => {
    expect(prescriptionActionUnavailableText('cancel', [compound('cancelled')])).toBe(
      "Cancel isn't available for prescriptions with status Cancelled."
    );
  });
});

describe('sending a prescription to another pharmacy', () => {
  const stored: PrescribedMedicationDTO = {
    ...rx('stopped'),
    encounterId: 'enc-1',
    instructions: 'Take 1 capsule by mouth twice daily',
    order: {
      patientId: 'patient-1',
      ndc: '00093310901',
      medicationDescription: 'Amoxicillin 500 mg capsule',
      quantityValue: 20,
      quantityUnit: 'Capsule',
      numberOfRefills: 0,
      substitutionAllowed: true,
    },
  };
  const pharmacy = { ncpdpId: '1234567', npi: '1234567890', name: 'Main St Pharmacy', phone: '5555550100' };
  const context = { practitionerId: 'pr-1', writtenDate: '2026-10-29', pharmacy: pharmacy as never };

  it("sends the vitals' height and weight with the new order", () => {
    const order = prescriptionToOrderForPharmacy(stored, {
      ...context,
      patientHeight: { cm: 131.5, measuredDate: '2026-10-08' },
      patientWeight: { kg: 28.12, measuredDate: '2026-10-08' },
    });
    expect(order).toMatchObject({
      patientHeight: { cm: 131.5, measuredDate: '2026-10-08' },
      patientWeight: { kg: 28.12, measuredDate: '2026-10-08' },
    });
  });

  it('leaves height and weight out when the visit has none', () => {
    const order = prescriptionToOrderForPharmacy(stored, context);
    expect(order).not.toHaveProperty('patientHeight');
    expect(order).not.toHaveProperty('patientWeight');
  });
});

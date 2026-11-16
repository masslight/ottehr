import { RenewalResponseInput } from 'utils/lib/types/api/erx.types';
import { OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPrescription, orderPrescription, respondToRenewal } from '../../src/api/api';

const ID = '3f2c9a1e-7b4d-4c8e-9f0a-1b2c3d4e5f60';

/** The eRx service refusing the call, as it writes its errors. */
const refuse = (message: string): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ message, code: 4000 }) }))
  );
};

const order = (): Promise<unknown> => orderPrescription('token', {} as OrderPrescriptionInput);
const answer = (): Promise<unknown> => respondToRenewal('token', {} as RenewalResponseInput);

// Claim audit r7, flag 3: staff can't act on eRx v4's own wording or a record id.
describe('eRx service errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('puts the messages staff meet in plain words, with no record id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cases: [string, () => Promise<unknown>, string][] = [
      [
        `Encounter ${ID} must have a location`,
        order,
        'This visit has no location. Add one to the visit and try again.',
      ],
      [`MedicationRequest not found: ${ID}`, answer, "This prescription can't be found."],
      [`Task ${ID} is not a renewal request`, answer, "This task isn't a refill request."],
      [`Location not found: ${ID}`, order, "This visit's location can't be found."],
      [
        'The renewal request has expired',
        answer,
        'This refill request has expired. The pharmacy needs to send a new one.',
      ],
    ];
    for (const [message, call, plain] of cases) {
      refuse(message);
      await expect(call()).rejects.toThrow(plain);
    }
  });

  it('shows the call’s usual failure for any other message with a record id, which goes to the console', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    refuse(`Encounter ${ID} does not belong to patient ${ID.toUpperCase()}`);
    await expect(order()).rejects.toThrow(new Error("The prescription couldn't be sent. Please try again."));
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(`does not belong to patient`));
    refuse(`MedicationRequest ${ID} was not sent to Surescripts`);
    await expect(cancelPrescription('token', {} as never)).rejects.toThrow(
      new Error("The cancellation couldn't be sent. Please try again.")
    );
    refuse(`Task ${ID} is already completed`);
    await expect(answer()).rejects.toThrow(
      new Error("The answer to the refill request couldn't be sent. Please try again.")
    );
    // One with no id still shows as written.
    refuse('Pharmacy rejected the order');
    await expect(order()).rejects.toThrow(new Error('Pharmacy rejected the order'));
  });
});

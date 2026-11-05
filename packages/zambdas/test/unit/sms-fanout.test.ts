import Oystehr from '@oystehr/sdk';
import { RelatedPerson } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSms, sendSmsToRelatedPersons } from '../../src/shared/communication';
import { sendErrors, sendWarning } from '../../src/shared/errors';

vi.mock('../../src/shared/errors', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendErrors: vi.fn(),
  sendWarning: vi.fn(),
}));

// The SDK types `code` as a number, but the messaging API delivers it as a string.
const invalidPhoneErrors = [4006, '4006'].map(
  (code) => new Oystehr.OystehrSdkError({ message: 'Invalid request phone number', code: code as number })
);

const oystehrSending = (send: (args: { resource: string }) => Promise<unknown>): Oystehr =>
  ({ transactionalSMS: { send: vi.fn(send) } }) as unknown as Oystehr;

const relatedPersons = (...ids: string[]): RelatedPerson[] =>
  ids.map((id) => ({ resourceType: 'RelatedPerson', id, patient: { reference: 'Patient/p-1' } }));

describe('SMS send errors reported to Sentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(invalidPhoneErrors)('reports an invalid recipient phone number as a warning (code $code)', async (error) => {
    const result = await sendSmsToRelatedPersons({
      relatedPersons: relatedPersons('rp-1'),
      message: 'hi',
      oystehr: oystehrSending(() => Promise.reject(error)),
      env: 'staging',
      failStrategy: 'never-throw',
    });

    expect(result).toEqual({ total: 1, sent: 0, failures: [{ recipient: 'RelatedPerson/rp-1', error }] });
    expect(sendErrors).not.toHaveBeenCalled();
    expect(sendWarning).toHaveBeenCalledWith('SMS recipient has an invalid phone number', 'staging', {
      recipient: 'RelatedPerson/rp-1',
      code: error.code,
      message: 'Invalid request phone number',
    });
  });

  it.each([
    new Oystehr.OystehrSdkError({ message: 'Internal error', code: 5000 }),
    new Oystehr.OystehrSdkError({ message: 'Invalid request message', code: 4006 }),
  ])('still reports other send failures as errors ($message)', async (outage) => {
    await sendSmsToRelatedPersons({
      relatedPersons: relatedPersons('rp-1', 'rp-2'),
      message: 'hi',
      oystehr: oystehrSending(({ resource }) =>
        Promise.reject(resource === 'RelatedPerson/rp-1' ? invalidPhoneErrors[0] : outage)
      ),
      env: 'staging',
      failStrategy: 'never-throw',
    });

    expect(sendErrors).toHaveBeenCalledTimes(1);
    expect(sendErrors).toHaveBeenCalledWith(outage, 'staging');
    expect(sendWarning).toHaveBeenCalledTimes(1);
  });

  it('reports an invalid phone number from a single send as a warning', async () => {
    await sendSms(
      'hi',
      'RelatedPerson/rp-1',
      oystehrSending(() => Promise.reject(invalidPhoneErrors[1])),
      'staging'
    );

    expect(sendErrors).not.toHaveBeenCalled();
  });
});

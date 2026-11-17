import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/lab/external/create-lab-order/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

const validBody = {
  dx: [{ code: 'J02.9', display: 'Acute pharyngitis', isPrimary: true }],
  encounter: { resourceType: 'Encounter', id: 'enc-1' },
  orderableItems: [{ item: { itemCode: '123' } }],
  psc: false,
  orderingLocation: { id: 'loc-1' },
  selectedPaymentMethod: 'selfPay',
};

describe('create-lab-order - validateRequestParameters', () => {
  test.each(['', '   ', '\n\t'])('drops a blank clinical info note (%j)', (clinicalInfoNoteByUser) => {
    const input = createMockZambdaInput({ ...validBody, clinicalInfoNoteByUser });
    expect(validateRequestParameters(input).clinicalInfoNoteByUser).toBeUndefined();
  });

  test('keeps a clinical info note with surrounding spaces as typed', () => {
    const input = createMockZambdaInput({ ...validBody, clinicalInfoNoteByUser: '  fasting since 8am ' });
    expect(validateRequestParameters(input).clinicalInfoNoteByUser).toBe('  fasting since 8am ');
  });

  test('leaves clinicalInfoNoteByUser undefined when it is not sent', () => {
    const input = createMockZambdaInput(validBody);
    expect(validateRequestParameters(input).clinicalInfoNoteByUser).toBeUndefined();
  });
});

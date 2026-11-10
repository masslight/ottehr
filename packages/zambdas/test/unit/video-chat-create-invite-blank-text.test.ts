import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../src/patient/video-chat-invites/create-invite/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const validBody = {
  appointmentId: 'appt-123',
  firstName: 'Jane',
  lastName: 'Doe',
  emailAddress: 'jane@example.com',
  phoneNumber: '5551234567',
};

const validate = (body: Record<string, unknown>): ReturnType<typeof validateRequestParameters> =>
  validateRequestParameters(createMockZambdaInput(body, { secrets: createMockSecrets() }));

describe('video-chat create-invite blank text', () => {
  test.each(['firstName', 'lastName'])('rejects a whitespace-only %s with an invalid input error', (field) => {
    expect(() => validate({ ...validBody, [field]: '  \t' })).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  test('trims surrounding whitespace from the names', () => {
    const result = validate({ ...validBody, firstName: ' Jane ', lastName: '  Doe' });
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
  });

  test.each(['', '   '])('drops a blank phone number %j when an email is given', (phoneNumber) => {
    expect(validate({ ...validBody, phoneNumber }).phoneNumber).toBeUndefined();
  });

  test.each(['', '   '])('drops a blank email address %j when a phone number is given', (emailAddress) => {
    expect(validate({ ...validBody, emailAddress }).emailAddress).toBeUndefined();
  });

  test('rejects a body whose phone number and email address are both blank', () => {
    expect(() => validate({ ...validBody, phoneNumber: '  ', emailAddress: ' ' })).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });
});

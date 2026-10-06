import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-patient/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const patient = {
  firstName: 'Example',
  lastName: 'Patient',
  dateOfBirth: '2015-04-12',
  sex: 'female',
  phoneNumber: '(202) 555-0143',
};

const validate = (body: unknown): ReturnType<typeof validateRequestParameters> =>
  validateRequestParameters(createMockZambdaInput(body, { secrets: createMockSecrets() }));

describe('create-patient validation', () => {
  it('throws when the Authorization header is missing', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ patient }, { headers: null, secrets: createMockSecrets() }))
    ).toThrow();
  });

  it('throws when secrets are missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ patient }, { secrets: null }))).toThrow();
  });

  it('throws when there is no body', () => {
    expect(() => validate(null)).toThrow();
  });

  it('accepts the details staff enter for a new patient', () => {
    expect(validate({ patient: { ...patient, middleName: 'Q' } }).patient).toEqual({ ...patient, middleName: 'Q' });
  });

  it.each(['firstName', 'lastName', 'dateOfBirth', 'sex', 'phoneNumber'])('requires %s', (field) => {
    expect(() => validate({ patient: { ...patient, [field]: undefined } })).toThrow();
  });

  it('rejects a blank name', () => {
    expect(() => validate({ patient: { ...patient, firstName: '  ' } })).toThrow();
  });

  it('rejects a date of birth that is not a date', () => {
    expect(() => validate({ patient: { ...patient, dateOfBirth: 'yesterday' } })).toThrow();
  });

  it('rejects a sex outside the allowed values', () => {
    expect(() => validate({ patient: { ...patient, sex: 'unknown' } })).toThrow();
  });

  it('rejects a phone number that is not valid', () => {
    expect(() => validate({ patient: { ...patient, phoneNumber: '12345' } })).toThrow();
  });
});

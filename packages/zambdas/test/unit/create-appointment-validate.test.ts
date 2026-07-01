import { User } from '@oystehr/sdk';
import { describe, expect, it } from 'vitest';
import { validateCreateAppointmentParams } from '../../src/patient/appointment/create-appointment/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

const validPatient = {
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  reasonForVisit: 'cough',
  sex: 'female',
  email: 'jane@example.com',
};

const makeInput = (body: Record<string, unknown>): ZambdaInput =>
  ({
    headers: null,
    body: JSON.stringify(body),
    secrets: { key: 'val' },
  }) as unknown as ZambdaInput;

const ehrUser = { id: 'u1', name: 'staff@x.com' } as unknown as User;

describe('create-appointment validateCreateAppointmentParams – followUpOptions', () => {
  const validBody = { slotId: '550e8400-e29b-41d4-a716-446655440000', patient: validPatient };

  it('accepts request without followUpOptions (regular visit)', () => {
    const result = validateCreateAppointmentParams(makeInput(validBody), ehrUser);
    expect(result.followUpOptions).toBeUndefined();
  });

  it('accepts followUpOptions with only parentEncounterId', () => {
    const result = validateCreateAppointmentParams(
      makeInput({ ...validBody, followUpOptions: { parentEncounterId: 'enc-1' } }),
      ehrUser
    );
    expect(result.followUpOptions).toEqual({ parentEncounterId: 'enc-1' });
  });

  it('accepts followUpOptions with skipPatientDiagnosis: true', () => {
    const result = validateCreateAppointmentParams(
      makeInput({ ...validBody, followUpOptions: { parentEncounterId: 'enc-1', skipPatientDiagnosis: true } }),
      ehrUser
    );
    expect(result.followUpOptions).toEqual({ parentEncounterId: 'enc-1', skipPatientDiagnosis: true });
  });

  it('accepts followUpOptions with skipPatientDiagnosis: false', () => {
    const result = validateCreateAppointmentParams(
      makeInput({ ...validBody, followUpOptions: { parentEncounterId: 'enc-1', skipPatientDiagnosis: false } }),
      ehrUser
    );
    expect(result.followUpOptions).toEqual({ parentEncounterId: 'enc-1', skipPatientDiagnosis: false });
  });

  it('rejects followUpOptions without parentEncounterId', () => {
    expect(() => validateCreateAppointmentParams(makeInput({ ...validBody, followUpOptions: {} }), ehrUser)).toThrow(
      /parentEncounterId/
    );
  });

  it('rejects followUpOptions with empty parentEncounterId', () => {
    expect(() =>
      validateCreateAppointmentParams(makeInput({ ...validBody, followUpOptions: { parentEncounterId: '' } }), ehrUser)
    ).toThrow('"followUpOptions.parentEncounterId" must be a non-empty string');
  });

  it('rejects followUpOptions with non-boolean skipPatientDiagnosis', () => {
    expect(() =>
      validateCreateAppointmentParams(
        makeInput({ ...validBody, followUpOptions: { parentEncounterId: 'enc-1', skipPatientDiagnosis: 'yes' } }),
        ehrUser
      )
    ).toThrow('"followUpOptions.skipPatientDiagnosis" must be a boolean if provided');
  });

  it('rejects non-object followUpOptions', () => {
    expect(() =>
      validateCreateAppointmentParams(
        makeInput({ ...validBody, followUpOptions: 'not-an-object' as unknown as Record<string, unknown> }),
        ehrUser
      )
    ).toThrow('"followUpOptions" must be an object');
  });

  it('rejects array as followUpOptions', () => {
    expect(() =>
      validateCreateAppointmentParams(
        makeInput({ ...validBody, followUpOptions: ['enc-1'] as unknown as Record<string, unknown> }),
        ehrUser
      )
    ).toThrow('"followUpOptions" must be an object');
  });

  it('silently ignores unknown fields in followUpOptions (project convention)', () => {
    const result = validateCreateAppointmentParams(
      makeInput({
        ...validBody,
        followUpOptions: { parentEncounterId: 'enc-1', unknownFlag: true } as unknown as Record<string, unknown>,
      }),
      ehrUser
    );
    expect(result.followUpOptions).toEqual({ parentEncounterId: 'enc-1' });
  });
});

import Oystehr from '@oystehr/sdk';
import { PatientArClaimItem } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect, summarizePatientBalance } from '../../../src/billing/get-billing-patient-balance/index';
import { validateRequestParameters } from '../../../src/billing/get-billing-patient-balance/validateRequestParameters';
import { fetchAllActivePatientArClaims } from '../../../src/billing/search-billing-patient-ar-claims/handler';
import { createMockSecrets, createMockZambdaInput } from '../validate-request-parameters/helpers';

vi.mock('../../../src/billing/search-billing-patient-ar-claims/handler', () => ({
  fetchAllActivePatientArClaims: vi.fn(),
}));

const item = (balance: number): PatientArClaimItem => ({
  claimId: 'claim-1',
  patientId: 'pat-1',
  patientName: 'Test, Katie',
  patientDob: '1990-01-15',
  encounterId: 'enc-1',
  appointmentId: 'appt-1',
  serviceDate: '2026-07-01',
  finalizationDate: '2026-06-05T10:00:00Z',
  billed: 250,
  allowed: 200,
  insurancePaid: 150,
  patientResp: 50,
  patientPaid: 0,
  balance,
  adjudicated: true,
});

describe('get-billing-patient-balance', () => {
  describe('validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns validated params for a valid request', () => {
      const secrets = createMockSecrets();
      const result = validateRequestParameters(createMockZambdaInput({ patientId: validUUID }, { secrets }));
      expect(result).toEqual({ patientId: validUUID, secrets });
    });

    it('throws when body is missing', () => {
      expect(() => validateRequestParameters(createMockZambdaInput(null))).toThrow();
    });

    it('throws when secrets are missing', () => {
      expect(() => validateRequestParameters(createMockZambdaInput({ patientId: validUUID }))).toThrow();
    });

    it('throws when patientId is missing or not a uuid', () => {
      const secrets = createMockSecrets();
      expect(() => validateRequestParameters(createMockZambdaInput({}, { secrets }))).toThrow();
      expect(() =>
        validateRequestParameters(createMockZambdaInput({ patientId: 'not-a-uuid' }, { secrets }))
      ).toThrow();
    });
  });

  describe('summarizePatientBalance', () => {
    it('returns a zeroed summary when the patient has no active AR claims', () => {
      expect(summarizePatientBalance([])).toEqual({
        currentBalance: 0,
        claimsWithPatientBalance: 0,
      });
    });

    it('sums claim balances and counts claims with a positive balance', () => {
      expect(summarizePatientBalance([item(50), item(25.5)])).toEqual({
        currentBalance: 75.5,
        claimsWithPatientBalance: 2,
      });
    });

    it('does not count zero-balance claims', () => {
      expect(summarizePatientBalance([item(50), item(0)])).toEqual({
        currentBalance: 50,
        claimsWithPatientBalance: 1,
      });
    });
  });

  describe('performEffect', () => {
    it('fetches the patient active AR claims and returns them with a balance summary', async () => {
      const claims = [item(50), item(25.5)];
      vi.mocked(fetchAllActivePatientArClaims).mockResolvedValueOnce(claims);
      const oystehr = {} as unknown as Oystehr;

      const result = await performEffect(oystehr, {
        patientId: 'pat-1',
        secrets: {},
      });

      expect(fetchAllActivePatientArClaims).toHaveBeenCalledWith(oystehr, 'pat-1');
      expect(result).toEqual({
        claims,
        balance: { currentBalance: 75.5, claimsWithPatientBalance: 2 },
      });
    });
  });
});

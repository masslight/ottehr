import Oystehr from '@oystehr/sdk';
import { PatientArClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it, vi } from 'vitest';
import { performEffect, summarizePatientBalance } from '../../../src/billing/get-billing-patient-balance/index';
import { validateRequestParameters } from '../../../src/billing/get-billing-patient-balance/validateRequestParameters';
import { fetchAllActivePatientArClaims } from '../../../src/billing/search-billing-patient-ar-claims/handler';
import { createMockSecrets, createMockZambdaInput } from '../validate-request-parameters/helpers';

vi.mock('../../../src/billing/search-billing-patient-ar-claims/handler', () => ({
  fetchAllActivePatientArClaims: vi.fn(),
}));

const oystehr = {} as unknown as Oystehr;

const claim = (overrides: Partial<PatientArClaimItem>): PatientArClaimItem => ({
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
  balance: 50,
  adjudicated: true,
  ...overrides,
});

describe('get-billing-patient-balance', () => {
  describe('validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns validated params for a valid request', () => {
      const secrets = createMockSecrets();
      const result = validateRequestParameters(createMockZambdaInput({ encounterIds: [validUUID] }, { secrets }));
      expect(result).toEqual({ encounterIds: [validUUID], secrets });
    });

    it('throws when body is missing', () => {
      expect(() => validateRequestParameters(createMockZambdaInput(null))).toThrow();
    });

    it('throws when secrets are missing', () => {
      expect(() => validateRequestParameters(createMockZambdaInput({ encounterIds: [validUUID] }))).toThrow();
    });

    it('throws when encounterIds is missing, empty, or not uuids', () => {
      const secrets = createMockSecrets();
      expect(() => validateRequestParameters(createMockZambdaInput({}, { secrets }))).toThrow();
      expect(() => validateRequestParameters(createMockZambdaInput({ encounterIds: [] }, { secrets }))).toThrow();
      expect(() =>
        validateRequestParameters(createMockZambdaInput({ encounterIds: ['not-a-uuid'] }, { secrets }))
      ).toThrow();
    });

    it('throws when encounterIds exceeds the request cap', () => {
      const secrets = createMockSecrets();
      const encounterIds = Array.from({ length: 1001 }, () => validUUID);
      expect(() => validateRequestParameters(createMockZambdaInput({ encounterIds }, { secrets }))).toThrow();
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
      expect(summarizePatientBalance([claim({ balance: 50 }), claim({ balance: 25.5 })])).toEqual({
        currentBalance: 75.5,
        claimsWithPatientBalance: 2,
      });
    });

    it('does not count zero-balance claims', () => {
      expect(summarizePatientBalance([claim({ balance: 50 }), claim({ balance: 0 })])).toEqual({
        currentBalance: 50,
        claimsWithPatientBalance: 1,
      });
    });

    it('includes claim credits in the current balance', () => {
      expect(summarizePatientBalance([claim({ balance: 25 }), claim({ balance: -40 })])).toEqual({
        currentBalance: -15,
        claimsWithPatientBalance: 1,
      });
    });
  });

  describe('performEffect', () => {
    it('fetches active AR claims for the encounters and returns them with a balance summary', async () => {
      const claims = [claim({ claimId: 'claim-1', balance: 75.5 }), claim({ claimId: 'claim-2', balance: 20 })];
      vi.mocked(fetchAllActivePatientArClaims).mockReset().mockResolvedValueOnce(claims);

      const result = await performEffect(oystehr, { encounterIds: ['enc-1', 'enc-2'], secrets: {} });

      expect(fetchAllActivePatientArClaims).toHaveBeenCalledWith(oystehr, {
        encounterIds: ['enc-1', 'enc-2'],
        includeZeroBalance: true,
        excludeFullyPaid: true,
      });
      expect(result).toEqual({
        claims,
        balance: { currentBalance: 95.5, claimsWithPatientBalance: 2 },
      });
    });
  });
});

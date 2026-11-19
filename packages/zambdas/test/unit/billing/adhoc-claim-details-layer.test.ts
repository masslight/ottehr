import { Claim, Identifier } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { claimDetailsLayer } from '../../../src/billing/adhoc/claim-extras';
import { ClaimLookups } from '../../../src/billing/claim-search';
import {
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_INSURANCE_ORD_SYSTEM,
} from '../../../src/billing/shared';

const lookups: ClaimLookups = {
  patients: [],
  payersByRef: new Map(),
  locations: [],
  providers: [],
  coverages: [],
  claimResponsesByClaimId: new Map(),
  patientPaidByClaimId: new Map(),
  writeOffs: new Map(),
};

const pccn = (value: string, insurance?: string): Identifier => ({
  system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  value,
  ...(insurance
    ? { type: { coding: [{ system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_INSURANCE_ORD_SYSTEM, code: insurance }] } }
    : {}),
});

const claimWith = (identifier: Identifier[]): Claim => ({
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  use: 'claim',
  type: { coding: [{ code: 'professional' }] },
  patient: { reference: 'Patient/patient-1' },
  created: '2026-09-07T12:00:00Z',
  provider: { reference: 'Organization/provider-1' },
  priority: { coding: [{ code: 'normal' }] },
  insurance: [],
  identifier,
});

describe('claimDetailsLayer payer claim control number', () => {
  it("reports the primary payer's PCCN whatever the identifier order", () => {
    const claim = claimWith([pccn('SECONDARY', 'secondary'), pccn('PRIMARY', 'primary')]);
    expect(claimDetailsLayer(claim, lookups).payerClaimControlNumber).toBe('PRIMARY');
  });

  it("reads a legacy type-less PCCN as the primary payer's", () => {
    const claim = claimWith([pccn('SECONDARY', 'secondary'), pccn('LEGACY')]);
    expect(claimDetailsLayer(claim, lookups).payerClaimControlNumber).toBe('LEGACY');
  });

  it('reports nothing when only another payer has a PCCN', () => {
    expect(claimDetailsLayer(claimWith([pccn('SECONDARY', 'secondary')]), lookups).payerClaimControlNumber).toBe('');
  });
});

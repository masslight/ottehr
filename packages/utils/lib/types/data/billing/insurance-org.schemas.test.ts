import { describe, expect, it } from 'vitest';
import {
  CreateInsuranceOrgInputSchema,
  DeleteInsuranceOrgInputSchema,
  SearchInsuranceOrgsInputSchema,
  UpdateInsuranceOrgInputSchema,
} from './insurance-org.schemas';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

const fullInput = {
  orgId: 'OTR-ACME',
  name: 'Acme Insurance',
  insuranceTypes: ['workers-comp', 'auto'],
  submissionMechanism: 'portal',
  acceptedClaimForm: 'cms-1500',
  note: 'Prefers electronic submission',
};

describe('insurance-org input schemas', () => {
  it('accepts a fully-populated create', () => {
    expect(CreateInsuranceOrgInputSchema.safeParse(fullInput).success).toBe(true);
  });

  it('accepts the minimal required fields, defaulting insuranceTypes to []', () => {
    const result = CreateInsuranceOrgInputSchema.safeParse({
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      submissionMechanism: 'email',
      acceptedClaimForm: 'other',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.insuranceTypes).toEqual([]);
  });

  it.each([
    ['missing orgId', { name: 'Acme', submissionMechanism: 'email', acceptedClaimForm: 'other' }],
    ['orgId without the OTR- prefix', { ...fullInput, orgId: 'ACME' }],
    ['orgId that is only the prefix', { ...fullInput, orgId: 'OTR-' }],
    ['missing name', { orgId: 'OTR-ACME', submissionMechanism: 'email', acceptedClaimForm: 'other' }],
    ['empty name', { ...fullInput, name: '   ' }],
    ['missing submissionMechanism', { orgId: 'OTR-ACME', name: 'Acme', acceptedClaimForm: 'other' }],
    ['unknown submissionMechanism', { ...fullInput, submissionMechanism: 'carrier-pigeon' }],
    ['missing acceptedClaimForm', { orgId: 'OTR-ACME', name: 'Acme', submissionMechanism: 'email' }],
    ['unknown acceptedClaimForm', { ...fullInput, acceptedClaimForm: 'cms-9999' }],
    ['unknown insuranceType', { ...fullInput, insuranceTypes: ['dental'] }],
  ])('rejects create with %s', (_label, input) => {
    expect(CreateInsuranceOrgInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts zero insurance types', () => {
    expect(CreateInsuranceOrgInputSchema.safeParse({ ...fullInput, insuranceTypes: [] }).success).toBe(true);
  });

  it('requires insuranceOrgId on update', () => {
    expect(UpdateInsuranceOrgInputSchema.safeParse(fullInput).success).toBe(false);
    expect(UpdateInsuranceOrgInputSchema.safeParse({ ...fullInput, insuranceOrgId: ORG_ID }).success).toBe(true);
  });

  it('search accepts an empty object and any combination of filters', () => {
    expect(SearchInsuranceOrgsInputSchema.safeParse({}).success).toBe(true);
    expect(SearchInsuranceOrgsInputSchema.safeParse({ insuranceOrgId: ORG_ID, name: 'Acme' }).success).toBe(true);
  });

  it('delete requires insuranceOrgId', () => {
    expect(DeleteInsuranceOrgInputSchema.safeParse({}).success).toBe(false);
    expect(DeleteInsuranceOrgInputSchema.safeParse({ insuranceOrgId: ORG_ID }).success).toBe(true);
  });

  it('accepts mechanism-specific submissionDetails', () => {
    expect(
      CreateInsuranceOrgInputSchema.safeParse({ ...fullInput, submissionDetails: { email: 'claims@acme.com' } }).success
    ).toBe(true);
    expect(
      CreateInsuranceOrgInputSchema.safeParse({
        ...fullInput,
        submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
      }).success
    ).toBe(true);
    expect(
      CreateInsuranceOrgInputSchema.safeParse({ ...fullInput, submissionDetails: { faxNumber: '555-123-4567' } })
        .success
    ).toBe(true);
    expect(
      CreateInsuranceOrgInputSchema.safeParse({
        ...fullInput,
        submissionDetails: { mailAddress: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' } },
      }).success
    ).toBe(true);
  });

  it('rejects a malformed submissionDetails.email', () => {
    const result = CreateInsuranceOrgInputSchema.safeParse({
      ...fullInput,
      submissionDetails: { email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
  });
});

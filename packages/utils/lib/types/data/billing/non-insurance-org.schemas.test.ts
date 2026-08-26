import { describe, expect, it } from 'vitest';
import {
  BILLING_NIO_REFERENCE_BASE,
  extractNioIdFromReferenceUrl,
  getNioReferenceUrl,
  isNioReferenceUrl,
} from '../../../helpers/helpers';
import {
  CreateNonInsuranceOrgInputSchema,
  ListNonInsuranceOrganizationsInputSchema,
  SearchNonInsuranceOrgsInputSchema,
  UpdateNonInsuranceOrgInputSchema,
} from './non-insurance-org.schemas';

const NIO_ID = '11111111-1111-4111-8111-111111111111';

const fullInput = {
  name: 'FedEx',
  employer: true,
  address: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
  contacts: [{ name: 'Jane Smith', title: 'Billing Manager', phone: '555-123-4567', email: 'jane@fedex.com' }],
  covers: [
    { category: 'workers-comp', billingMode: 'insurance', payerId: 'payer-org-id' },
    {
      category: 'occupational-medicine',
      submission: {
        preferredMechanism: 'fax',
        fax: '555-999-0000',
        email: 'occmed@fedex.com',
        portalNotes: 'portal.fedex.com, login in vault',
        mailAddress: { line1: 'PO Box 5' },
      },
    },
    { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
  ],
};

describe('non-insurance-org input schemas', () => {
  it('accepts a minimal create (name + employer only)', () => {
    expect(CreateNonInsuranceOrgInputSchema.safeParse({ name: 'FedEx', employer: false }).success).toBe(true);
  });

  it('accepts a fully-populated create', () => {
    expect(CreateNonInsuranceOrgInputSchema.safeParse(fullInput).success).toBe(true);
  });

  it.each([
    ['missing name', { employer: false }],
    ['empty name', { name: '   ', employer: false }],
    ['missing employer', { name: 'FedEx' }],
  ])('rejects create with %s', (_label, input) => {
    expect(CreateNonInsuranceOrgInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts a partial address — no completeness rule', () => {
    const result = CreateNonInsuranceOrgInputSchema.safeParse({
      name: 'FedEx',
      employer: false,
      address: { zip: '90210' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate coverage categories', () => {
    const result = CreateNonInsuranceOrgInputSchema.safeParse({
      name: 'FedEx',
      employer: false,
      covers: [
        { category: 'other', name: 'A' },
        { category: 'other', name: 'B' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown coverage category', () => {
    const result = CreateNonInsuranceOrgInputSchema.safeParse({
      name: 'FedEx',
      employer: false,
      covers: [{ category: 'medical-clearance' }],
    });
    expect(result.success).toBe(false);
  });

  it('requires billingMode on workers-comp coverage', () => {
    const result = CreateNonInsuranceOrgInputSchema.safeParse({
      name: 'FedEx',
      employer: false,
      covers: [{ category: 'workers-comp' }],
    });
    expect(result.success).toBe(false);
  });

  it('requires a name on each contact but nothing else', () => {
    const base = { name: 'FedEx', employer: false };
    expect(CreateNonInsuranceOrgInputSchema.safeParse({ ...base, contacts: [{ name: 'Jane' }] }).success).toBe(true);
    expect(CreateNonInsuranceOrgInputSchema.safeParse({ ...base, contacts: [{ title: 'Manager' }] }).success).toBe(
      false
    );
  });

  it('rejects a malformed contact email', () => {
    const result = CreateNonInsuranceOrgInputSchema.safeParse({
      name: 'FedEx',
      employer: false,
      contacts: [{ name: 'Jane', email: 'not-an-email' }],
    });
    expect(result.success).toBe(false);
  });

  it('requires nioId on update', () => {
    expect(UpdateNonInsuranceOrgInputSchema.safeParse({ name: 'FedEx', employer: false }).success).toBe(false);
    expect(UpdateNonInsuranceOrgInputSchema.safeParse({ nioId: NIO_ID, name: 'FedEx', employer: false }).success).toBe(
      true
    );
  });

  it('search accepts only the employers-only filter value', () => {
    expect(SearchNonInsuranceOrgsInputSchema.safeParse({ employer: true }).success).toBe(true);
    expect(SearchNonInsuranceOrgsInputSchema.safeParse({ employer: false }).success).toBe(false);
    expect(SearchNonInsuranceOrgsInputSchema.safeParse({}).success).toBe(true);
  });

  it('directory input accepts nioId / employerOnly / search', () => {
    expect(
      ListNonInsuranceOrganizationsInputSchema.safeParse({ nioId: NIO_ID, employerOnly: true, search: 'fed' }).success
    ).toBe(true);
    expect(ListNonInsuranceOrganizationsInputSchema.safeParse({ employerOnly: false }).success).toBe(false);
  });
});

describe('NIO reference tokens', () => {
  it('round-trips an id through the token', () => {
    const token = getNioReferenceUrl(NIO_ID);
    expect(token).toBe(`${BILLING_NIO_REFERENCE_BASE}/${NIO_ID}`);
    expect(isNioReferenceUrl(token)).toBe(true);
    expect(extractNioIdFromReferenceUrl(token)).toBe(NIO_ID);
  });

  it.each([
    ['a plain FHIR reference', `Organization/${NIO_ID}`],
    ['a payer URL', 'https://rcm-api.zapehr.com/v1/payer/abc123'],
    ['the bare base with no id', BILLING_NIO_REFERENCE_BASE],
    ['undefined', undefined],
  ])('does not treat %s as an NIO reference', (_label, value) => {
    expect(isNioReferenceUrl(value)).toBe(false);
    expect(extractNioIdFromReferenceUrl(value)).toBeUndefined();
  });
});

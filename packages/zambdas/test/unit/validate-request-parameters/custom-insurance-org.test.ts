import {
  CreateCustomInsuranceOrgInputSchema,
  DeleteCustomInsuranceOrgInputSchema,
  ListCustomInsuranceOrganizationsInputSchema,
  SearchCustomInsuranceOrgsInputSchema,
  UpdateCustomInsuranceOrgInputSchema,
} from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('insurance-org zambdas - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('create returns validated params for a valid request', () => {
    const input = createMockZambdaInput(
      {
        orgId: 'OTR-ACME',
        name: 'Acme Insurance',
        insuranceTypes: ['workers-comp', 'auto'],
        submissionMechanism: 'portal',
        submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
        acceptedClaimForm: 'cms-1500',
        note: 'Prefers electronic submission',
      },
      { secrets }
    );
    expect(validateWithSchema(CreateCustomInsuranceOrgInputSchema, input)).toEqual({
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      insuranceTypes: ['workers-comp', 'auto'],
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
      acceptedClaimForm: 'cms-1500',
      note: 'Prefers electronic submission',
      secrets,
    });
  });

  test('create accepts contacts and requires a name on each', () => {
    const input = createMockZambdaInput(
      {
        orgId: 'OTR-ACME',
        name: 'Acme Insurance',
        submissionMechanism: 'email',
        acceptedClaimForm: 'other',
        contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
      },
      { secrets }
    );
    expect(validateWithSchema(CreateCustomInsuranceOrgInputSchema, input)).toMatchObject({
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    });

    expect(() =>
      validateWithSchema(
        CreateCustomInsuranceOrgInputSchema,
        createMockZambdaInput(
          {
            orgId: 'OTR-ACME',
            name: 'Acme Insurance',
            submissionMechanism: 'email',
            acceptedClaimForm: 'other',
            contacts: [{ title: 'Missing a name' }],
          },
          { secrets }
        )
      )
    ).toThrow();
  });

  test('create rejects an invalid submissionDetails.email', () => {
    const input = createMockZambdaInput(
      {
        orgId: 'OTR-ACME',
        name: 'Acme Insurance',
        submissionMechanism: 'email',
        submissionDetails: { email: 'not-an-email' },
        acceptedClaimForm: 'other',
      },
      { secrets }
    );
    expect(() => validateWithSchema(CreateCustomInsuranceOrgInputSchema, input)).toThrow();
  });

  test('create defaults insuranceTypes to an empty array', () => {
    const input = createMockZambdaInput(
      { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'other' },
      { secrets }
    );
    expect(validateWithSchema(CreateCustomInsuranceOrgInputSchema, input)).toMatchObject({ insuranceTypes: [] });
  });

  test('create rejects a missing body and missing secrets', () => {
    expect(() =>
      validateWithSchema(CreateCustomInsuranceOrgInputSchema, createMockZambdaInput(null, { secrets }))
    ).toThrow();
    expect(() =>
      validateWithSchema(
        CreateCustomInsuranceOrgInputSchema,
        createMockZambdaInput({
          orgId: 'OTR-ACME',
          name: 'Acme Insurance',
          submissionMechanism: 'email',
          acceptedClaimForm: 'other',
        })
      )
    ).toThrow();
  });

  test('create rejects an id that does not start with "OTR-"', () => {
    const input = createMockZambdaInput(
      { orgId: 'ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'other' },
      { secrets }
    );
    expect(() => validateWithSchema(CreateCustomInsuranceOrgInputSchema, input)).toThrow();
  });

  test('create rejects an invalid submissionMechanism or acceptedClaimForm', () => {
    expect(() =>
      validateWithSchema(
        CreateCustomInsuranceOrgInputSchema,
        createMockZambdaInput(
          {
            orgId: 'OTR-ACME',
            name: 'Acme Insurance',
            submissionMechanism: 'carrier-pigeon',
            acceptedClaimForm: 'other',
          },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateWithSchema(
        CreateCustomInsuranceOrgInputSchema,
        createMockZambdaInput(
          { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'cms-9999' },
          { secrets }
        )
      )
    ).toThrow();
  });

  test('update requires insuranceOrgId', () => {
    expect(() =>
      validateWithSchema(
        UpdateCustomInsuranceOrgInputSchema,
        createMockZambdaInput(
          { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'other' },
          { secrets }
        )
      )
    ).toThrow();
    expect(
      validateWithSchema(
        UpdateCustomInsuranceOrgInputSchema,
        createMockZambdaInput(
          {
            insuranceOrgId: ORG_ID,
            orgId: 'OTR-ACME',
            name: 'Acme Insurance',
            submissionMechanism: 'email',
            acceptedClaimForm: 'other',
          },
          { secrets }
        )
      )
    ).toEqual({
      insuranceOrgId: ORG_ID,
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      insuranceTypes: [],
      submissionMechanism: 'email',
      acceptedClaimForm: 'other',
      secrets,
    });
  });

  test('search accepts an empty object body', () => {
    expect(validateWithSchema(SearchCustomInsuranceOrgsInputSchema, createMockZambdaInput({}, { secrets }))).toEqual({
      secrets,
    });
  });

  test('delete requires insuranceOrgId', () => {
    expect(() =>
      validateWithSchema(DeleteCustomInsuranceOrgInputSchema, createMockZambdaInput({}, { secrets }))
    ).toThrow();
    expect(
      validateWithSchema(
        DeleteCustomInsuranceOrgInputSchema,
        createMockZambdaInput({ insuranceOrgId: ORG_ID }, { secrets })
      )
    ).toEqual({
      insuranceOrgId: ORG_ID,
      secrets,
    });
  });

  test('list accepts an empty object body', () => {
    expect(
      validateWithSchema(ListCustomInsuranceOrganizationsInputSchema, createMockZambdaInput({}, { secrets }))
    ).toEqual({ secrets });
  });

  test('list accepts insuranceOrgId and search', () => {
    expect(
      validateWithSchema(
        ListCustomInsuranceOrganizationsInputSchema,
        createMockZambdaInput({ insuranceOrgId: ORG_ID, search: 'Acme' }, { secrets })
      )
    ).toEqual({
      insuranceOrgId: ORG_ID,
      search: 'Acme',
      secrets,
    });
  });
});

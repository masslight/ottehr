import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validateCreate } from '../../../src/billing/create-billing-insurance-org/validateRequestParameters';
import { validateRequestParameters as validateDelete } from '../../../src/billing/delete-billing-insurance-org/validateRequestParameters';
import { validateRequestParameters as validateSearch } from '../../../src/billing/search-billing-insurance-orgs/validateRequestParameters';
import { validateRequestParameters as validateUpdate } from '../../../src/billing/update-billing-insurance-org/validateRequestParameters';
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
        acceptedClaimForm: 'cms-1500',
        note: 'Prefers electronic submission',
      },
      { secrets }
    );
    expect(validateCreate(input)).toEqual({
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      insuranceTypes: ['workers-comp', 'auto'],
      submissionMechanism: 'portal',
      acceptedClaimForm: 'cms-1500',
      note: 'Prefers electronic submission',
      secrets,
    });
  });

  test('create defaults insuranceTypes to an empty array', () => {
    const input = createMockZambdaInput(
      { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'other' },
      { secrets }
    );
    expect(validateCreate(input)).toMatchObject({ insuranceTypes: [] });
  });

  test('create rejects a missing body and missing secrets', () => {
    expect(() => validateCreate(createMockZambdaInput(null, { secrets }))).toThrow();
    expect(() =>
      validateCreate(
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
    expect(() => validateCreate(input)).toThrow();
  });

  test('create rejects an invalid submissionMechanism or acceptedClaimForm', () => {
    expect(() =>
      validateCreate(
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
      validateCreate(
        createMockZambdaInput(
          { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'cms-9999' },
          { secrets }
        )
      )
    ).toThrow();
  });

  test('update requires insuranceOrgId', () => {
    expect(() =>
      validateUpdate(
        createMockZambdaInput(
          { orgId: 'OTR-ACME', name: 'Acme Insurance', submissionMechanism: 'email', acceptedClaimForm: 'other' },
          { secrets }
        )
      )
    ).toThrow();
    expect(
      validateUpdate(
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
    expect(validateSearch(createMockZambdaInput({}, { secrets }))).toEqual({ secrets });
  });

  test('delete requires insuranceOrgId', () => {
    expect(() => validateDelete(createMockZambdaInput({}, { secrets }))).toThrow();
    expect(validateDelete(createMockZambdaInput({ insuranceOrgId: ORG_ID }, { secrets }))).toEqual({
      insuranceOrgId: ORG_ID,
      secrets,
    });
  });
});

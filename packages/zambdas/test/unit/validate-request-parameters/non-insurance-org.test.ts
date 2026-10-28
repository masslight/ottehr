import {
  CreateNonInsuranceOrgInputSchema,
  DeleteNonInsuranceOrgInputSchema,
  ListNonInsuranceOrganizationsInputSchema,
  SearchNonInsuranceOrgsInputSchema,
  UpdateNonInsuranceOrgInputSchema,
} from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const NIO_ID = '11111111-1111-4111-8111-111111111111';

describe('non-insurance-org zambdas - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('create returns validated params for a valid request', () => {
    const input = createMockZambdaInput(
      {
        name: 'FedEx',
        employer: true,
        covers: [{ category: 'workers-comp', billingMode: 'insurance', payerId: 'payer-1' }],
      },
      { secrets }
    );
    expect(validateWithSchema(CreateNonInsuranceOrgInputSchema, input)).toEqual({
      name: 'FedEx',
      employer: true,
      covers: [{ category: 'workers-comp', billingMode: 'insurance', payerId: 'payer-1' }],
      secrets,
    });
  });

  test('create rejects a missing body and missing secrets', () => {
    expect(() =>
      validateWithSchema(CreateNonInsuranceOrgInputSchema, createMockZambdaInput(null, { secrets }))
    ).toThrow();
    expect(() =>
      validateWithSchema(CreateNonInsuranceOrgInputSchema, createMockZambdaInput({ name: 'FedEx', employer: false }))
    ).toThrow();
  });

  test('create rejects a schema violation (duplicate coverage category)', () => {
    const input = createMockZambdaInput(
      { name: 'FedEx', employer: false, covers: [{ category: 'other' }, { category: 'other' }] },
      { secrets }
    );
    expect(() => validateWithSchema(CreateNonInsuranceOrgInputSchema, input)).toThrow();
  });

  test('update requires nioId', () => {
    expect(() =>
      validateWithSchema(
        UpdateNonInsuranceOrgInputSchema,
        createMockZambdaInput({ name: 'FedEx', employer: false }, { secrets })
      )
    ).toThrow();
    expect(
      validateWithSchema(
        UpdateNonInsuranceOrgInputSchema,
        createMockZambdaInput({ nioId: NIO_ID, name: 'FedEx', employer: false }, { secrets })
      )
    ).toEqual({ nioId: NIO_ID, name: 'FedEx', employer: false, secrets });
  });

  test('search accepts an empty object body', () => {
    expect(validateWithSchema(SearchNonInsuranceOrgsInputSchema, createMockZambdaInput({}, { secrets }))).toEqual({
      secrets,
    });
  });

  test('delete requires nioId', () => {
    expect(() =>
      validateWithSchema(DeleteNonInsuranceOrgInputSchema, createMockZambdaInput({}, { secrets }))
    ).toThrow();
    expect(
      validateWithSchema(DeleteNonInsuranceOrgInputSchema, createMockZambdaInput({ nioId: NIO_ID }, { secrets }))
    ).toEqual({ nioId: NIO_ID, secrets });
  });

  test('list accepts directory filters and rejects employerOnly=false', () => {
    expect(
      validateWithSchema(
        ListNonInsuranceOrganizationsInputSchema,
        createMockZambdaInput({ employerOnly: true, search: 'fed' }, { secrets })
      )
    ).toEqual({
      employerOnly: true,
      search: 'fed',
      secrets,
    });
    expect(() =>
      validateWithSchema(
        ListNonInsuranceOrganizationsInputSchema,
        createMockZambdaInput({ employerOnly: false }, { secrets })
      )
    ).toThrow();
  });
});

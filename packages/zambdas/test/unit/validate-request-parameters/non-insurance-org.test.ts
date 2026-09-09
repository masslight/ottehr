import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validateCreate } from '../../../src/billing/create-billing-non-insurance-org/validateRequestParameters';
import { validateRequestParameters as validateDelete } from '../../../src/billing/delete-billing-non-insurance-org/validateRequestParameters';
import { validateRequestParameters as validateList } from '../../../src/billing/list-non-insurance-organizations/validateRequestParameters';
import { validateRequestParameters as validateSearch } from '../../../src/billing/search-billing-non-insurance-orgs/validateRequestParameters';
import { validateRequestParameters as validateUpdate } from '../../../src/billing/update-billing-non-insurance-org/validateRequestParameters';
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
    expect(validateCreate(input)).toEqual({
      name: 'FedEx',
      employer: true,
      covers: [{ category: 'workers-comp', billingMode: 'insurance', payerId: 'payer-1' }],
      secrets,
    });
  });

  test('create rejects a missing body and missing secrets', () => {
    expect(() => validateCreate(createMockZambdaInput(null, { secrets }))).toThrow();
    expect(() => validateCreate(createMockZambdaInput({ name: 'FedEx', employer: false }))).toThrow();
  });

  test('create rejects a schema violation (duplicate coverage category)', () => {
    const input = createMockZambdaInput(
      { name: 'FedEx', employer: false, covers: [{ category: 'other' }, { category: 'other' }] },
      { secrets }
    );
    expect(() => validateCreate(input)).toThrow();
  });

  test('update requires nioId', () => {
    expect(() => validateUpdate(createMockZambdaInput({ name: 'FedEx', employer: false }, { secrets }))).toThrow();
    expect(
      validateUpdate(createMockZambdaInput({ nioId: NIO_ID, name: 'FedEx', employer: false }, { secrets }))
    ).toEqual({ nioId: NIO_ID, name: 'FedEx', employer: false, secrets });
  });

  test('search accepts an empty object body', () => {
    expect(validateSearch(createMockZambdaInput({}, { secrets }))).toEqual({ secrets });
  });

  test('delete requires nioId', () => {
    expect(() => validateDelete(createMockZambdaInput({}, { secrets }))).toThrow();
    expect(validateDelete(createMockZambdaInput({ nioId: NIO_ID }, { secrets }))).toEqual({ nioId: NIO_ID, secrets });
  });

  test('list accepts directory filters and rejects employerOnly=false', () => {
    expect(validateList(createMockZambdaInput({ employerOnly: true, search: 'fed' }, { secrets }))).toEqual({
      employerOnly: true,
      search: 'fed',
      secrets,
    });
    expect(() => validateList(createMockZambdaInput({ employerOnly: false }, { secrets }))).toThrow();
  });
});

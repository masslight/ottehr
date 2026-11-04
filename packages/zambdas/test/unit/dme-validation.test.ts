import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets } from 'utils/lib/secrets';
import {
  CreateDmeOrderInputSchema,
  GetDmeOrderPdfInputSchema,
  GetDmeOrdersInputSchema,
  UpdateDmeOrderInputSchema,
} from 'utils/lib/types/api/dme.types';
import { APIError, APIErrorCode, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodTypeAny } from 'zod';
import { index as createDmeOrder } from '../../src/ehr/dme/create-dme-order/index';
import { index as getDmeOrderPdf } from '../../src/ehr/dme/get-dme-order-pdf/index';
import { index as getDmeOrders } from '../../src/ehr/dme/get-dme-orders/index';
import { index as updateDmeOrder } from '../../src/ehr/dme/update-dme-order/index';
import { ZambdaInput } from '../../src/shared/types/common';
import { validateWithSchema } from '../../src/shared/validation';

// A request that gets past validation stops at the M2M token with this sentinel instead of reaching the network.
const PASSED_VALIDATION: APIError = {
  code: APIErrorCode.MISSING_REQUEST_SECRETS,
  message: 'passed validation',
  statusCode: 418,
};
const { mockM2MToken } = vi.hoisted(() => ({ mockM2MToken: vi.fn() }));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: mockM2MToken,
}));

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';
const DEVICE_REQUEST_ID = '33333333-3333-4333-8333-333333333333';

const secrets: Secrets = { PROJECT_API: 'https://project.api', ENVIRONMENT: 'local' };

const makeInput = (body: unknown, overrides: Partial<ZambdaInput> = {}): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets,
  ...overrides,
});

const rejectionOf = (schema: ZodTypeAny, input: ZambdaInput): APIError => {
  try {
    validateWithSchema(schema, input);
  } catch (error) {
    return error as APIError;
  }
  throw new Error('expected the request to be rejected');
};

// No statusCode on the error means wrapHandler answers 400.
const expectInvalid = (schema: ZodTypeAny, body: unknown, message: string | RegExp): void => {
  const error = rejectionOf(schema, makeInput(body));
  expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  expect(error.statusCode).toBeUndefined();
  expect(error.message).toMatch(message);
};

const minimalOrderFields = {
  itemName: 'Crutches',
  quantity: 1,
  orderedByPractitionerId: PRACTITIONER_ID,
};

const fullOrderFields = {
  itemName: '  Ankle Brace ',
  diagnoses: [{ code: 's93.401a', display: 'Sprain of right ankle' }],
  quantity: 2,
  billingCodes: [{ code: ' l1906', display: 'Ankle foot orthosis' }],
  laterality: 'LT',
  modifier: 'NU',
  duration: { value: 2, unit: 'weeks' },
  orderedByPractitionerId: PRACTITIONER_ID,
  instructions: '  Wear at all times  ',
  external: true,
  thirdParty: { name: ' Acme Medical ', address: '1 Supply Rd', phone: '(555) 555-0100', fax: '+1 555.555.0101' },
};

const schemas: [string, ZodTypeAny, Record<string, unknown>][] = [
  ['create-dme-order', CreateDmeOrderInputSchema, { ...minimalOrderFields, encounterId: ENCOUNTER_ID }],
  ['get-dme-orders', GetDmeOrdersInputSchema, { encounterId: ENCOUNTER_ID }],
  ['update-dme-order', UpdateDmeOrderInputSchema, { action: 'dispense', deviceRequestId: DEVICE_REQUEST_ID }],
  ['get-dme-order-pdf', GetDmeOrderPdfInputSchema, { deviceRequestId: DEVICE_REQUEST_ID }],
];

function defaultsFor(schema: ZodTypeAny): Record<string, unknown> {
  if (schema === CreateDmeOrderInputSchema) return { diagnoses: [], billingCodes: [], external: false };
  return {};
}

describe.each(schemas)('%s request envelope', (_name, schema, validBody) => {
  it('returns the parsed body together with the secrets', () => {
    expect(validateWithSchema(schema, makeInput(validBody))).toEqual({ ...validBody, ...defaultsFor(schema), secrets });
  });

  it.each([null, ''])('rejects a %j body as missing', (body) => {
    expect(rejectionOf(schema, makeInput(validBody, { body }))).toEqual(MISSING_REQUEST_BODY);
  });

  it('rejects a request without secrets', () => {
    expect(rejectionOf(schema, makeInput(validBody, { secrets: null }))).toEqual(MISSING_REQUEST_SECRETS);
  });

  it('rejects a body that is not JSON', () => {
    expect(rejectionOf(schema, makeInput(validBody, { body: '{not json' })).code).toBe(APIErrorCode.INVALID_INPUT);
  });

  it.each([null, [], 'text', 1])('rejects a %j body that is not an object', (body) => {
    expectInvalid(schema, body, /Expected object|Invalid input/);
  });
});

describe('create-dme-order input', () => {
  const order = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...minimalOrderFields,
    encounterId: ENCOUNTER_ID,
    ...overrides,
  });

  it('trims free text and normalizes codes on a full external order', () => {
    expect(
      validateWithSchema(CreateDmeOrderInputSchema, makeInput({ ...fullOrderFields, encounterId: ENCOUNTER_ID }))
    ).toEqual({
      ...fullOrderFields,
      itemName: 'Ankle Brace',
      diagnoses: [{ code: 'S93.401A', display: 'Sprain of right ankle' }],
      billingCodes: [{ code: 'L1906', display: 'Ankle foot orthosis' }],
      instructions: 'Wear at all times',
      thirdParty: { ...fullOrderFields.thirdParty, name: 'Acme Medical' },
      encounterId: ENCOUNTER_ID,
      secrets,
    });
  });

  it('drops a menuItemId sent by an older client', () => {
    expect(
      validateWithSchema(CreateDmeOrderInputSchema, makeInput(order({ menuItemId: 'menu-item-1' })))
    ).not.toHaveProperty('menuItemId');
  });

  it.each(['U07.1', 'M25561', 'C4A.10', 'Z3A.39'])('accepts the ICD-10 code %s', (code) => {
    expect(
      validateWithSchema(CreateDmeOrderInputSchema, makeInput(order({ diagnoses: [{ code, display: '' }] }))).diagnoses
    ).toEqual([{ code, display: '' }]);
  });

  it.each([
    ['a missing encounterId', { encounterId: undefined }, 'encounterId is required'],
    ['a non-uuid encounterId', { encounterId: 'enc-1' }, 'encounterId must be a uuid'],
    ['an empty orderedByPractitionerId', { orderedByPractitionerId: '' }, 'orderedByPractitionerId must be a uuid'],
    ['a blank item name', { itemName: '   ' }, 'DME item is required'],
    ['an item name over 200 characters', { itemName: 'x'.repeat(201) }, 'at most 200'],
    ['quantity 0', { quantity: 0 }, 'Quantity dispensed must be a positive number'],
    ['quantity -1', { quantity: -1 }, 'Quantity dispensed must be a positive number'],
    ['quantity 1.5', { quantity: 1.5 }, 'Quantity dispensed must be a whole number'],
    ["quantity '2'", { quantity: '2' }, 'Expected number, received string'],
    ['quantity 1000', { quantity: 1000 }, 'Quantity dispensed must be at most 999'],
    ['a missing quantity', { quantity: undefined }, 'Required at "quantity"'],
    ['an unknown laterality', { laterality: 'LEFT' }, /Invalid enum value.*laterality/],
    ['a lowercase laterality', { laterality: 'lt' }, /Invalid enum value.*laterality/],
    ['an unknown modifier', { modifier: 'KX' }, /Invalid enum value.*modifier/],
    ['duration 0', { duration: { value: 0, unit: 'days' } }, 'Duration must be a positive number'],
    ['a negative duration', { duration: { value: -2, unit: 'days' } }, 'Duration must be a positive number'],
    ['duration over 999', { duration: { value: 1000, unit: 'days' } }, 'Duration must be at most 999'],
    ['an unknown duration unit', { duration: { value: 2, unit: 'months' } }, /Invalid enum value.*duration\.unit/],
    ['a duration without a unit', { duration: { value: 2 } }, 'Required at "duration.unit"'],
    ['a malformed diagnosis code', { diagnoses: [{ code: 'sprain', display: '' }] }, 'Expected an ICD-10 code'],
    ['an empty diagnosis code', { diagnoses: [{ code: ' ', display: '' }] }, 'Expected an ICD-10 code'],
    ['a malformed billing code', { billingCodes: [{ code: 'L1906 LT', display: 'AFO' }] }, 'CPT/HCPCS'],
    [
      'a billing code with an empty display',
      { billingCodes: [{ code: 'L1906', display: '' }] },
      'description is required at "billingCodes[0].display"',
    ],
    [
      'a billing code with a blank display',
      { billingCodes: [{ code: 'L1906', display: ' ' }] },
      'description is required at "billingCodes[0].display"',
    ],
    [
      'more than 50 billing codes',
      { billingCodes: Array.from({ length: 51 }, () => ({ code: 'L1906', display: 'AFO' })) },
      'at most 50',
    ],
    ['instructions over 2000 characters', { instructions: 'x'.repeat(2001) }, 'at most 2000'],
    ['a non-boolean external', { external: 'yes' }, 'Expected boolean'],
    ['a phone with letters', { thirdParty: { phone: 'call the front desk' } }, 'Expected a phone number'],
    ['a fax over 30 characters', { thirdParty: { fax: '1'.repeat(31) } }, 'at most 30'],
    ['a vendor address over 500 characters', { thirdParty: { address: 'x'.repeat(501) } }, 'at most 500'],
  ])('rejects %s', (_case, overrides, message) => {
    expectInvalid(CreateDmeOrderInputSchema, order(overrides), message);
  });
});

describe('get-dme-orders input', () => {
  it('accepts a deviceRequestId on its own', () => {
    expect(validateWithSchema(GetDmeOrdersInputSchema, makeInput({ deviceRequestId: DEVICE_REQUEST_ID }))).toEqual({
      deviceRequestId: DEVICE_REQUEST_ID,
      secrets,
    });
  });

  it.each([
    ['both ids', { encounterId: ENCOUNTER_ID, deviceRequestId: DEVICE_REQUEST_ID }, 'Exactly one of'],
    ['neither id', {}, 'Exactly one of'],
    ['a non-uuid encounterId', { encounterId: 'enc-1' }, 'encounterId must be a uuid'],
    ['a non-uuid deviceRequestId', { deviceRequestId: 'dr-1' }, 'deviceRequestId must be a uuid'],
  ])('rejects %s', (_case, body, message) => {
    expectInvalid(GetDmeOrdersInputSchema, body, message);
  });
});

describe('update-dme-order input', () => {
  it.each(['dispense', 'delete'])('accepts %s with only a deviceRequestId', (action) => {
    expect(
      validateWithSchema(UpdateDmeOrderInputSchema, makeInput({ action, deviceRequestId: DEVICE_REQUEST_ID }))
    ).toEqual({ action, deviceRequestId: DEVICE_REQUEST_ID, secrets });
  });

  it('parses the order fields of an update', () => {
    const result = validateWithSchema(
      UpdateDmeOrderInputSchema,
      makeInput({ action: 'update', deviceRequestId: DEVICE_REQUEST_ID, fields: fullOrderFields })
    );
    expect(result).toMatchObject({
      action: 'update',
      fields: { itemName: 'Ankle Brace', billingCodes: [{ code: 'L1906', display: 'Ankle foot orthosis' }] },
    });
  });

  it.each([
    ['an unknown action', { action: 'cancel', deviceRequestId: DEVICE_REQUEST_ID }, 'Invalid discriminator value'],
    ['a missing action', { deviceRequestId: DEVICE_REQUEST_ID }, 'Invalid discriminator value'],
    ['a non-uuid deviceRequestId', { action: 'dispense', deviceRequestId: 'dr-1' }, 'deviceRequestId must be a uuid'],
    ['a missing deviceRequestId', { action: 'delete' }, 'deviceRequestId is required'],
    ['an update without fields', { action: 'update', deviceRequestId: DEVICE_REQUEST_ID }, 'Required at "fields"'],
    [
      'an update with invalid fields',
      { action: 'update', deviceRequestId: DEVICE_REQUEST_ID, fields: { ...minimalOrderFields, quantity: 0 } },
      'positive number at "fields.quantity"',
    ],
  ])('rejects %s', (_case, body, message) => {
    expectInvalid(UpdateDmeOrderInputSchema, body, message);
  });
});

describe('get-dme-order-pdf input', () => {
  it.each([
    ['a missing deviceRequestId', {}, 'deviceRequestId is required'],
    ['a non-uuid deviceRequestId', { deviceRequestId: 'dr-1' }, 'deviceRequestId must be a uuid'],
  ])('rejects %s', (_case, body, message) => {
    expectInvalid(GetDmeOrderPdfInputSchema, body, message);
  });
});

// index is typed as a 3-arg AWS Handler; at runtime it takes just the input.
type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
const asHandler = (handler: unknown): ZambdaHandler => handler as ZambdaHandler;

describe('DME handlers validate before doing any work', () => {
  beforeEach(() => {
    mockM2MToken.mockReset().mockRejectedValue(PASSED_VALIDATION);
  });

  it.each([
    ['create-dme-order', asHandler(createDmeOrder), { ...minimalOrderFields, encounterId: ENCOUNTER_ID, quantity: 0 }],
    ['get-dme-orders', asHandler(getDmeOrders), {}],
    ['update-dme-order', asHandler(updateDmeOrder), { action: 'cancel', deviceRequestId: DEVICE_REQUEST_ID }],
    ['get-dme-order-pdf', asHandler(getDmeOrderPdf), { deviceRequestId: 'dr-1' }],
  ])('%s answers 400 to an invalid body', async (_name, handler, body) => {
    const response = await handler(makeInput(body));
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(mockM2MToken).not.toHaveBeenCalled();
  });
});

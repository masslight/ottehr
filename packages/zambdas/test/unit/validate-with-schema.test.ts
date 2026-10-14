import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { ZambdaInput } from '../../src/shared/types/common';
import { validateWithSchema } from '../../src/shared/validation';

const schema = z.object({
  id: z.string().uuid(),
  count: z.number().int().default(1),
  tags: z
    .string()
    .optional()
    .transform((value) => value?.split(',') ?? []),
});

const ID = '550e8400-e29b-41d4-a716-446655440000';
const secrets: Secrets = { PROJECT_API: 'https://project.api' };

const makeInput = (overrides: Partial<ZambdaInput>): ZambdaInput => ({
  headers: null,
  body: JSON.stringify({ id: ID }),
  secrets,
  ...overrides,
});

describe('validateWithSchema', () => {
  it('returns the parsed body together with the secrets', () => {
    const result = validateWithSchema(schema, makeInput({ body: JSON.stringify({ id: ID, count: 3, tags: 'a,b' }) }));

    expect(result).toEqual({ id: ID, count: 3, tags: ['a', 'b'], secrets });
    expectTypeOf(result).toEqualTypeOf<z.output<typeof schema> & { secrets: Secrets }>();
  });

  it('applies defaults and transforms and strips keys the schema does not declare', () => {
    const result = validateWithSchema(schema, makeInput({ body: JSON.stringify({ id: ID, extra: 'dropped' }) }));

    expect(result).toEqual({ id: ID, count: 1, tags: [], secrets });
  });

  it.each([null, ''])('throws MISSING_REQUEST_BODY when the body is %j', (body) => {
    expect(() => validateWithSchema(schema, makeInput({ body }))).toThrow(
      expect.objectContaining(MISSING_REQUEST_BODY)
    );
  });

  it('throws MISSING_REQUEST_SECRETS when the secrets are missing', () => {
    expect(() => validateWithSchema(schema, makeInput({ secrets: null }))).toThrow(
      expect.objectContaining(MISSING_REQUEST_SECRETS)
    );
  });

  it('throws INVALID_INPUT_ERROR when the body is not JSON', () => {
    expect(() => validateWithSchema(schema, makeInput({ body: 'not json' }))).toThrow(
      expect.objectContaining(INVALID_INPUT_ERROR('Invalid JSON in request body'))
    );
  });

  it('throws INVALID_INPUT_ERROR naming each field that fails the schema', () => {
    expect(() => validateWithSchema(schema, makeInput({ body: JSON.stringify({ id: 'abc', count: 1.5 }) }))).toThrow(
      expect.objectContaining(
        INVALID_INPUT_ERROR('Validation error: Invalid uuid at "id"; Expected integer, received float at "count"')
      )
    );
  });
});

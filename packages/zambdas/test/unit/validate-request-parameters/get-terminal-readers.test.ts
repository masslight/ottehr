import { describe, expect, test } from 'vitest';
import { GetTerminalReadersBodySchema } from '../../../src/rcm/payments/get-terminal-readers/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-terminal-readers - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { stripeAccountId: 'acct_1234567890abcdef', terminalLocationId: 'tml_abc123' },
      { secrets }
    );
    const result = validateWithSchema(GetTerminalReadersBodySchema, input);

    expect(result).toEqual({
      stripeAccountId: 'acct_1234567890abcdef',
      terminalLocationId: 'tml_abc123',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });

  test('should throw when stripeAccountId is missing', () => {
    const input = createMockZambdaInput({ terminalLocationId: 'tml_abc123' }, { secrets });
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });

  test('should throw when stripeAccountId is empty', () => {
    const input = createMockZambdaInput({ stripeAccountId: '', terminalLocationId: 'tml_abc123' }, { secrets });
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });

  test('should throw when terminalLocationId is missing', () => {
    const input = createMockZambdaInput({ stripeAccountId: 'acct_1234567890abcdef' }, { secrets });
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });

  test('should throw when terminalLocationId is empty', () => {
    const input = createMockZambdaInput(
      { stripeAccountId: 'acct_1234567890abcdef', terminalLocationId: '' },
      { secrets }
    );
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });

  test('should throw when both fields are missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(GetTerminalReadersBodySchema, input)).toThrow();
  });
});

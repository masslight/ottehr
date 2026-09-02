import Oystehr from '@oystehr/sdk';
import { describe, expect, it } from 'vitest';
import { isResponseSizeExceededError } from './responseSize';

const MAX_SIZE_MESSAGE =
  'An internal response size (7,340,032) exceeds the maximum allowed size (6,291,456).  ' +
  'Please refine your query with pagination or use the _elements parameter for FHIR resources.';

describe('isResponseSizeExceededError', () => {
  it('recognizes the SDK error the FHIR server raises', () => {
    expect(
      isResponseSizeExceededError(
        new Oystehr.OystehrSdkError({
          code: 4130,
          message: MAX_SIZE_MESSAGE,
        })
      )
    ).toBe(true);
  });

  it('trusts the code over the message', () => {
    expect(
      isResponseSizeExceededError(
        new Oystehr.OystehrSdkError({
          code: 4130,
          message: 'Please refine your search.',
        })
      )
    ).toBe(true);
  });

  it('recognizes the code whether it arrives as a number or a string', () => {
    const asString = new Oystehr.OystehrSdkError({
      code: 4130,
      message: 'refine your search',
    });
    (asString as unknown as { code: string }).code = '4130';
    expect(isResponseSizeExceededError(asString)).toBe(true);
  });

  it('recognizes the failure by message when the SDK class is gone', () => {
    expect(isResponseSizeExceededError(new Error(MAX_SIZE_MESSAGE))).toBe(true);
    expect(
      isResponseSizeExceededError({
        message: MAX_SIZE_MESSAGE,
      })
    ).toBe(true);
  });

  it('does not claim an unrelated failure', () => {
    expect(isResponseSizeExceededError(new Error('unsupported search parameter'))).toBe(false);
    expect(
      isResponseSizeExceededError(
        new Oystehr.OystehrSdkError({
          code: 400,
          message: 'bad request',
        })
      )
    ).toBe(false);
    expect(isResponseSizeExceededError(undefined)).toBe(false);
    expect(isResponseSizeExceededError('string error')).toBe(false);
  });
});

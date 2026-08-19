import { OperationOutcome } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isFhirNotFoundError } from '../errors';

const notFoundOutcome: OperationOutcome = {
  resourceType: 'OperationOutcome',
  issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Resource not found' }],
};

/** The shape `@oystehr/sdk` actually throws: an Error subclass with the outcome on `cause`. */
class FakeOystehrFHIRError extends Error {
  code: number;
  cause: OperationOutcome;
  constructor(code: number, cause: OperationOutcome) {
    super('Resource not found');
    this.name = 'OystehrFHIRError';
    this.code = code;
    this.cause = cause;
  }
}

describe('isFhirNotFoundError', () => {
  it('recognises the SDK error class, whose outcome lives on `cause`', () => {
    // The bug this guards: code testing `error.resourceType` / `error.issue` directly saw undefined
    // on both, so every 404 was escalated to a 500.
    expect(isFhirNotFoundError(new FakeOystehrFHIRError(404, notFoundOutcome))).toBe(true);
  });

  it('recognises a bare OperationOutcome, however it reaches us', () => {
    expect(isFhirNotFoundError(notFoundOutcome)).toBe(true);
  });

  it('treats any 404 as not-found even without a usable outcome', () => {
    expect(isFhirNotFoundError(new FakeOystehrFHIRError(404, { resourceType: 'OperationOutcome', issue: [] }))).toBe(
      true
    );
  });

  it('does not swallow other FHIR failures', () => {
    const badRequest = new FakeOystehrFHIRError(400, {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Unknown search parameter' }],
    });
    expect(isFhirNotFoundError(badRequest)).toBe(false);
  });

  it('does not swallow ordinary errors, null or undefined', () => {
    expect(isFhirNotFoundError(new Error('boom'))).toBe(false);
    expect(isFhirNotFoundError(null)).toBe(false);
    expect(isFhirNotFoundError(undefined)).toBe(false);
    expect(isFhirNotFoundError('not-found')).toBe(false);
  });
});

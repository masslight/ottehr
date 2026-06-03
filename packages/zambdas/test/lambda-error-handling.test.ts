import Oystehr from '@oystehr/sdk';
import { OperationOutcome } from 'fhir/r4b';
import { APIError, APIErrorCode, FHIR_RESOURCE_IS_GONE, INVALID_INPUT_ERROR } from 'utils';
import { describe, expect, test } from 'vitest';
import { topLevelCatch } from '../src/shared/lambda';

const ZAMBDA = 'test-zambda';
const ENV = 'local';

const parseBody = (body: string): any => (body ? JSON.parse(body) : {});

describe('handleErrorResult (via topLevelCatch)', () => {
  test('APIError with an explicit statusCode returns that status and { message, code }', async () => {
    // This is the exact shape patchTaskStatus throws when it converts a 4xx FHIR error.
    const error: APIError = {
      ...INVALID_INPUT_ERROR('Task.status: invalid transition'),
      statusCode: 409,
    };

    const result = await topLevelCatch(ZAMBDA, error, ENV);

    expect(result.statusCode).toBe(409);
    expect(parseBody(result.body)).toEqual({
      code: APIErrorCode.INVALID_INPUT,
      message: 'Task.status: invalid transition',
    });
  });

  test('APIError without a statusCode defaults to 400', async () => {
    const error = INVALID_INPUT_ERROR('bad value');

    const result = await topLevelCatch(ZAMBDA, error, ENV);

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body)).toEqual({
      code: APIErrorCode.INVALID_INPUT,
      message: 'bad value',
    });
  });

  test('APIError carrying its own statusCode returns the code unchanged', async () => {
    const result = await topLevelCatch(ZAMBDA, FHIR_RESOURCE_IS_GONE(), ENV);

    expect(result.statusCode).toBe(410);
    expect(parseBody(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_IS_GONE);
  });

  test('an unconverted OystehrFHIRError is not an APIError, so it still falls to 500', async () => {
    // this is why the try-catch in patchTaskStatus is necessary to recognize raw SDK errors
    const operationOutcome: OperationOutcome = {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'invalid',
          details: {
            text: 'Task.status: invalid transition',
          },
        },
      ],
    };
    const error = new Oystehr.OystehrFHIRError({
      error: operationOutcome,
      code: 400,
    });

    const result = await topLevelCatch(ZAMBDA, error, ENV);

    expect(result.statusCode).toBe(500);
    expect(parseBody(result.body)).toEqual({
      error: 'Internal error',
    });
  });

  test('a plain Error returns 500 internal error', async () => {
    const result = await topLevelCatch(ZAMBDA, new Error('boom'), ENV);

    expect(result.statusCode).toBe(500);
    expect(parseBody(result.body)).toEqual({
      error: 'Internal error',
    });
  });
});

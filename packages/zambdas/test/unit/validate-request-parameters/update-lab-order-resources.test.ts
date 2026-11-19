import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/lab/external/update-lab-order-resources/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

const noteBody = (event: 'addOrderLevelNote' | 'updateOrderLevelNote', note: unknown): Record<string, unknown> => ({
  event,
  requisitionNumber: 'REQ-1',
  note,
});

describe('update-lab-order-resources - validateRequestParameters order level note', () => {
  test.each(['', '   ', '\n\t'])('rejects adding a blank order level note (%j) with INVALID_INPUT', (note) => {
    const input = createMockZambdaInput(noteBody('addOrderLevelNote', note));
    expect(() => validateRequestParameters(input)).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  test.each(['', '   ', '\n\t'])('turns a blank updated order level note (%j) into an empty string', (note) => {
    const result = validateRequestParameters(createMockZambdaInput(noteBody('updateOrderLevelNote', note)));
    expect(result).toMatchObject({ event: 'updateOrderLevelNote', note: '' });
  });

  test.each(['addOrderLevelNote', 'updateOrderLevelNote'] as const)(
    'keeps a %s note with surrounding spaces as typed',
    (event) => {
      const result = validateRequestParameters(createMockZambdaInput(noteBody(event, '  call before 5pm ')));
      expect(result).toMatchObject({ event, note: '  call before 5pm ' });
    }
  );

  test('still rejects a note over 300 characters', () => {
    const input = createMockZambdaInput(noteBody('addOrderLevelNote', 'a'.repeat(301)));
    expect(() => validateRequestParameters(input)).toThrow('Note must be under 300 characters long');
  });
});

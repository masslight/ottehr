import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/lab/in-house/handle-in-house-lab-results/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('handle-in-house-lab-results - validateRequestParameters', () => {
  test.each(['', '   ', '\n\t'])('rejects a blank result entry (%j) with INVALID_INPUT', (entry) => {
    const input = createMockZambdaInput({ serviceRequestId: 'sr-1', data: { 'obs-def-1': 'ok', 'obs-def-2': entry } });
    expect(() => validateRequestParameters(input)).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  test('passes result entries through as typed', () => {
    const data = { 'obs-def-1': '  trace amount ', 'obs-def-2': '5.2', 'obs-def-3': 'positive' };
    const result = validateRequestParameters(createMockZambdaInput({ serviceRequestId: 'sr-1', data }));
    expect(result.data).toEqual(data);
  });
});

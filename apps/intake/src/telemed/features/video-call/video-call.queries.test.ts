import { OystehrAPIClient } from 'ui-components';
import { describe, expect, test } from 'vitest';
import { isJoinCallEnabled } from './video-call.queries';

describe('isJoinCallEnabled', () => {
  const apiClient = {} as OystehrAPIClient;

  test('is enabled when both client and appointment id exist', () => {
    expect(isJoinCallEnabled(apiClient, 'appointment-id')).toBe(true);
  });

  test('is disabled without an appointment id', () => {
    expect(isJoinCallEnabled(apiClient, undefined)).toBe(false);
  });

  test('is disabled without an api client', () => {
    expect(isJoinCallEnabled(null, 'appointment-id')).toBe(false);
  });
});

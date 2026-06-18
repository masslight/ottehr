import { RoleType } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/update-user/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: {} as any,
});

describe('update-user - validateRequestParameters', () => {
  test('accepts a single valid role', () => {
    const result = validateRequestParameters(
      createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000', selectedRoles: [RoleType.Staff] })
    );
    expect(result.selectedRoles).toEqual([RoleType.Staff]);
  });

  test('accepts multiple valid roles', () => {
    const result = validateRequestParameters(
      createMockZambdaInput({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        selectedRoles: [RoleType.Staff, RoleType.Manager],
      })
    );
    expect(result.selectedRoles).toEqual([RoleType.Staff, RoleType.Manager]);
  });

  test('throws when selectedRoles is an empty array', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000', selectedRoles: [] })
      )
    ).toThrow('At least one role must be selected.');
  });

  test('throws when selectedRoles contains an unknown role', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000', selectedRoles: ['NotARole'] })
      )
    ).toThrow(/Invalid enum value/);
  });

  test('omitting selectedRoles is allowed (other update flows)', () => {
    const result = validateRequestParameters(createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000' }));
    expect(result.selectedRoles).toBeUndefined();
  });

  test('throws when userId is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ selectedRoles: [RoleType.Staff] }))).toThrow(
      /userId/
    );
  });
});

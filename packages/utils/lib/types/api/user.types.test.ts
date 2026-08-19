import { describe, expect, it } from 'vitest';
import { hasPractitionerProfile, isRoleType, RoleType } from './user.types';

describe('hasPractitionerProfile', () => {
  it('recognises a Practitioner profile reference', () => {
    expect(hasPractitionerProfile('Practitioner/abc-123')).toBe(true);
  });

  it('rejects the Patient profile a self-registered user carries', () => {
    // This is what "needs review" means in the employee list: signed up, never set up as staff.
    expect(hasPractitionerProfile('Patient/abc-123')).toBe(false);
  });

  it('rejects a missing or empty profile', () => {
    expect(hasPractitionerProfile(undefined)).toBe(false);
    expect(hasPractitionerProfile('')).toBe(false);
  });

  it('is not fooled by a resource type that merely contains the word', () => {
    expect(hasPractitionerProfile('PractitionerRole/abc-123')).toBe(false);
  });
});

describe('isRoleType', () => {
  it.each(Object.values(RoleType))('accepts the real role %s', (role) => {
    expect(isRoleType(role)).toBe(true);
  });

  it('rejects Patient, which is a role users hold but not an employee role', () => {
    // The form submits whatever roles a user already had; echoing `Patient` back failed validation
    // in update-user, and converting such a user to staff is when it should fall away.
    expect(isRoleType('Patient')).toBe(false);
  });

  it('rejects unknown role names', () => {
    expect(isRoleType('')).toBe(false);
    expect(isRoleType('administrator')).toBe(false); // case-sensitive
    expect(isRoleType('NotARole')).toBe(false);
  });

  it('keeps Inactive, which has no checkbox but is still a real role', () => {
    // Dropping it here would silently reactivate a deactivated user on any unrelated save.
    expect(isRoleType(RoleType.Inactive)).toBe(true);
  });
});

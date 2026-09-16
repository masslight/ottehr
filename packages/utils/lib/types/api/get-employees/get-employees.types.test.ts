import { describe, expect, it } from 'vitest';
import { RoleType } from '../user.types';
import { canBeAssignedAsProvider, isCustomerSupport, isInactive, isProvider } from './get-employees.types';

describe('isProvider', () => {
  it('is true for a user holding the Provider role', () => {
    expect(isProvider({ roles: [RoleType.Provider] })).toBe(true);
  });

  it('is true alongside other roles — a provider may also be a manager', () => {
    expect(isProvider({ roles: [RoleType.Manager, RoleType.Provider] })).toBe(true);
  });

  it('is false for clinical staff who are not providers', () => {
    // Clinician is deliberately not a provider: it's the NPI-less clinical role, and provider-only
    // lists (assignment dropdowns, licensure filters) must not pick it up.
    expect(isProvider({ roles: [RoleType.Clinician] })).toBe(false);
    expect(isProvider({ roles: [RoleType.Staff] })).toBe(false);
  });

  it('is false for a user awaiting review, who holds no roles yet', () => {
    expect(isProvider({ roles: [] })).toBe(false);
  });
});

describe('isCustomerSupport', () => {
  it('is true for the internal support role', () => {
    expect(isCustomerSupport({ roles: [RoleType.CustomerSupport] })).toBe(true);
  });

  it('is false for every practice role', () => {
    expect(isCustomerSupport({ roles: [RoleType.Administrator] })).toBe(false);
    expect(isCustomerSupport({ roles: [RoleType.Provider, RoleType.Manager] })).toBe(false);
  });

  it('is false when no roles are held', () => {
    expect(isCustomerSupport({ roles: [] })).toBe(false);
  });
});

describe('isInactive', () => {
  it('returns true when the user holds the Inactive role', () => {
    expect(isInactive({ roles: [RoleType.Provider, RoleType.Inactive] })).toBe(true);
  });

  it('returns false for an active user', () => {
    expect(isInactive({ roles: [RoleType.Provider] })).toBe(false);
  });
});

// Backs the visit's Provider assignment on both sides of the wire: nothing clears the encounter's
// Attender when an employee changes role or is deactivated, so a stale assignment has to be caught
// by re-reading the roles.
describe('canBeAssignedAsProvider', () => {
  it('accepts a plain provider', () => {
    expect(canBeAssignedAsProvider({ roles: [RoleType.Provider] })).toBe(true);
  });

  it('accepts a provider holding additional roles', () => {
    expect(canBeAssignedAsProvider({ roles: [RoleType.Manager, RoleType.Provider] })).toBe(true);
  });

  it('rejects a non-provider', () => {
    expect(canBeAssignedAsProvider({ roles: [RoleType.Clinician] })).toBe(false);
  });

  // Deactivation adds Inactive and leaves Provider in place, so isProvider alone still says yes.
  it('rejects a deactivated provider', () => {
    expect(canBeAssignedAsProvider({ roles: [RoleType.Provider, RoleType.Inactive] })).toBe(false);
  });

  it('rejects a customer support provider', () => {
    expect(canBeAssignedAsProvider({ roles: [RoleType.Provider, RoleType.CustomerSupport] })).toBe(false);
  });

  it('rejects a user with no roles', () => {
    expect(canBeAssignedAsProvider({ roles: [] })).toBe(false);
  });
});

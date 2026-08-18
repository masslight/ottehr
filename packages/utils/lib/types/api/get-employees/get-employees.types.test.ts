import { describe, expect, it } from 'vitest';
import { RoleType } from '../user.types';
import { isCustomerSupport, isProvider } from './get-employees.types';

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

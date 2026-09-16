import { describe, expect, it } from 'vitest';
import { RoleType } from '../user.types';
import { canSignVisitNote } from './sign-appointment.types';

describe('canSignVisitNote', () => {
  it('permits the Provider role', () => {
    expect(canSignVisitNote({ roles: [RoleType.Provider] })).toBe(true);
  });

  it('permits a provider who also holds non-clinical roles', () => {
    expect(canSignVisitNote({ roles: [RoleType.Administrator, RoleType.Provider] })).toBe(true);
  });

  // The point of the gate: Clinician is provider-level for everything except NPI-gated actions.
  it('refuses the Clinician role', () => {
    expect(canSignVisitNote({ roles: [RoleType.Clinician] })).toBe(false);
  });

  it('refuses a clinician who also holds administrative roles', () => {
    expect(canSignVisitNote({ roles: [RoleType.Clinician, RoleType.Administrator, RoleType.Manager] })).toBe(false);
  });

  it('refuses a user with no roles', () => {
    expect(canSignVisitNote({ roles: [] })).toBe(false);
  });

  // Role names reach the backend as plain strings, so a name outside RoleType must not slip through.
  it('refuses unrecognized role names', () => {
    expect(canSignVisitNote({ roles: ['provider', 'NotARole'] })).toBe(false);
  });
});

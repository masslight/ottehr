import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useJournalOwners } from '../../src/features/journal/hooks/useJournalOwners';

const state = vi.hoisted(
  (): { all: Record<string, unknown>[]; providers: Record<string, unknown>[]; me: Record<string, unknown> } => {
    const employee = (id: string, firstName: string, roles: string[]): Record<string, unknown> => ({
      id,
      profile: `Practitioner/${id}`,
      firstName,
      lastName: 'Test',
      name: `${firstName} Test`,
      roles,
      status: 'Active',
    });
    const ana = employee('ana', 'Ana', ['Provider']);
    const demo = employee('demo', 'Demo', ['Provider', 'Administrator', 'Customer Support']);
    const cal = employee('cal', 'Cal', ['Clinician']);
    return { all: [ana, demo, cal], providers: [ana], me: ana };
  }
);

vi.mock('src/features/visits/shared/hooks/useGetEmployees', () => ({
  toProviderDetails: (e: { profile: string; name: string }) => ({
    practitionerId: e.profile.split('/')[1],
    name: e.name,
  }),
  useGetEmployeesWithDetails: () => ({ data: { all: state.all, providers: state.providers }, isLoading: false }),
}));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ profile: state.me.profile, roles: (state.me.roles as string[]).map((name) => ({ name })) }),
}));

describe('useJournalOwners', () => {
  it('leaves Customer Support users out of "Journal for", as the Provider picker does', () => {
    const { result } = renderHook(() => useJournalOwners());
    expect(result.current.owners.map((o) => o.practitionerId)).toEqual(['ana', 'cal']);
  });

  it('offers "Make me provider" by the rule of "Assign Current Chart to Me": an active Provider, not Customer Support', () => {
    state.me = state.all[0];
    expect(renderHook(() => useJournalOwners()).result.current.iAmProvider).toBe(true);
    state.me = state.all[1];
    expect(renderHook(() => useJournalOwners()).result.current.iAmProvider).toBe(false);
    state.me = state.all[2];
    expect(renderHook(() => useJournalOwners()).result.current.iAmProvider).toBe(false);
  });
});

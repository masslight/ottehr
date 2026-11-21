import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useJournalOwners } from '../../src/features/journal/hooks/useJournalOwners';

const state = vi.hoisted(() => {
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
  return { all: [ana, demo, cal], providers: [ana], me: 'Practitioner/ana' };
});

vi.mock('src/features/visits/shared/hooks/useGetEmployees', () => ({
  toProviderDetails: (e: { profile: string; name: string }) => ({
    practitionerId: e.profile.split('/')[1],
    name: e.name,
  }),
  useGetEmployeesWithDetails: () => ({ data: { all: state.all, providers: state.providers }, isLoading: false }),
}));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profile: state.me }) }));

describe('useJournalOwners', () => {
  it('leaves Customer Support users out of "Journal for", as the Provider picker does', () => {
    const { result } = renderHook(() => useJournalOwners());
    expect(result.current.owners.map((o) => o.practitionerId)).toEqual(['ana', 'cal']);
  });

  it('offers "Make me provider" only to someone on the Provider picker’s list', () => {
    state.me = 'Practitioner/ana';
    expect(renderHook(() => useJournalOwners()).result.current.iAmProvider).toBe(true);
    state.me = 'Practitioner/demo';
    expect(renderHook(() => useJournalOwners()).result.current.iAmProvider).toBe(false);
  });
});

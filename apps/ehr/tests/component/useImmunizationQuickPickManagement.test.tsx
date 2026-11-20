import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { useImmunizationQuickPickManagement } from '../../src/features/immunization/hooks/useImmunizationQuickPickManagement';

const mockedQuickPicks = [{ id: 'qp-1', name: 'Alpha vaccine' }] as any[];

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: { config: { accessToken: 'token' } },
  }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: (a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''),
  useMergedImmunizationQuickPicks: () => ({
    quickPicks: mockedQuickPicks,
    loading: true,
    refetch: vi.fn(),
  }),
}));

describe('useImmunizationQuickPickManagement', () => {
  it('returns the merged quick pick loading state', () => {
    const { result } = renderHook(() => {
      const methods = useForm();
      return useImmunizationQuickPickManagement({ methods, applyOrderDetails: false });
    });

    expect(result.current.mergedQuickPicks).toEqual(mockedQuickPicks);
    expect(result.current.mergedQuickPicksLoading).toBe(true);
  });

  it('applies the vaccine of a quick pick that is in the vaccine list', () => {
    const { result } = renderHook(() => {
      const methods = useForm();
      return { methods, hook: useImmunizationQuickPickManagement({ methods, applyOrderDetails: true }) };
    });

    act(() => result.current.hook.onQuickPickSelect({ name: 'Tdap adult', vaccine: { id: '115', name: 'Tdap' } }));

    expect(result.current.methods.getValues('details.medication')).toEqual({ id: '115', name: 'Tdap' });
  });

  it('leaves the vaccine to pick when the quick pick was saved against a vaccine that is not in the list', () => {
    const { result } = renderHook(() => {
      const methods = useForm();
      return { methods, hook: useImmunizationQuickPickManagement({ methods, applyOrderDetails: true }) };
    });

    act(() =>
      result.current.hook.onQuickPickSelect({
        name: 'Tdap adult',
        vaccine: { id: 'a3f1c2d4-0000-4000-8000-000000000001', name: 'Tdap (Adacel/Boostrix)' },
        dose: '0.5',
      })
    );

    expect(result.current.methods.getValues('details.medication')).toBeNull();
    expect(result.current.methods.getValues('details.dose')).toBe('0.5');
  });
});

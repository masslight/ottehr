import { act, renderHook } from '@testing-library/react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
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
});

describe('useImmunizationQuickPickManagement — applying a quick pick', () => {
  const applyQuickPick = (quickPick: ImmunizationQuickPickData): UseFormReturn => {
    const { result } = renderHook(() => {
      const methods = useForm();
      return { methods, hook: useImmunizationQuickPickManagement({ methods, applyOrderDetails: true }) };
    });
    act(() => result.current.hook.onQuickPickSelect(quickPick));
    return result.current.methods;
  };

  it('fills in the vaccine from the CVX list', () => {
    const methods = applyQuickPick({ name: 'Tdap adult', vaccine: { id: '115', name: 'Tdap' }, dose: '0.5' });

    expect(methods.getValues('details.medication')).toEqual({ id: '115', name: 'Tdap' });
    expect(methods.getValues('details.dose')).toBe('0.5');
  });

  it('leaves the vaccine to pick when the quick pick was saved against a vaccine that is not in the list', () => {
    const methods = applyQuickPick({
      name: 'Tdap adult',
      vaccine: { id: 'config-medication-tdap', name: 'Tdap (Adacel/Boostrix)' },
      dose: '0.5',
    });

    expect(methods.getValues('details.medication')).toBeNull();
    expect(methods.getValues('details.dose')).toBe('0.5');
  });
});

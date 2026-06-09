import { renderHook } from '@testing-library/react';
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
});

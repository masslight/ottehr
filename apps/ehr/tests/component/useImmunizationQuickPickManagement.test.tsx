import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createImmunizationQuickPick, updateImmunizationQuickPick, getImmunizationQuickPicks } = vi.hoisted(() => ({
  createImmunizationQuickPick: vi.fn(),
  updateImmunizationQuickPick: vi.fn(),
  getImmunizationQuickPicks: vi.fn(),
}));

const mockedQuickPicks = [{ id: 'qp-1', name: 'Alpha vaccine' }] as any[];
const oystehrZambda = { config: { accessToken: 'token' } };

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  createImmunizationQuickPick,
  updateImmunizationQuickPick,
  getImmunizationQuickPicks,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: (a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''),
  useMergedImmunizationQuickPicks: () => ({
    quickPicks: mockedQuickPicks,
    loading: true,
    refetch: vi.fn(),
  }),
}));

import {
  emptyImmunizationForm,
  ImmunizationFormValues,
} from '../../src/features/immunization/components/immunizationForm';
import { useImmunizationQuickPickManagement } from '../../src/features/immunization/hooks/useImmunizationQuickPickManagement';

const FORM: ImmunizationFormValues = {
  details: {
    medication: { id: '115', name: 'Tdap' },
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    location: { code: '368208006', name: 'Left Deltoid' },
    manufacturer: 'Merck and Co., Inc.',
    instructions: 'After consent',
    orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
  },
  administrationDetails: {
    lot: 'L-42',
    expDate: '2027-01-31',
    mvx: 'MSD',
    ndc: '00006-4681-00',
    cptCodes: [{ code: '90715', display: 'Tdap' }],
  },
};

describe('useImmunizationQuickPickManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getImmunizationQuickPicks.mockResolvedValue({ quickPicks: [] });
    createImmunizationQuickPick.mockResolvedValue({});
    updateImmunizationQuickPick.mockResolvedValue({});
  });

  it('returns the merged quick pick loading state', () => {
    const { result } = renderHook(() => useImmunizationQuickPickManagement({ getValues: emptyImmunizationForm }));

    expect(result.current.mergedQuickPicks).toEqual(mockedQuickPicks);
    expect(result.current.mergedQuickPicksLoading).toBe(true);
  });

  it('names a new quick pick after the form, and saves the form with the vaccine CVX and the manufacturer MVX', async () => {
    const { result } = renderHook(() => useImmunizationQuickPickManagement({ getValues: () => FORM }));

    await act(() => result.current.openQuickPickDialog());
    expect(result.current.quickPickDialogOpen).toBe(true);
    expect(result.current.quickPickName).toBe(
      'Tdap | 0.5 | ml | Intramuscular route | Left Deltoid | lot: L-42 | exp: 2027-01-31'
    );

    await act(() => result.current.onSaveAsQuickPick());

    expect(createImmunizationQuickPick).toHaveBeenCalledWith(oystehrZambda, {
      quickPick: {
        name: 'Tdap | 0.5 | ml | Intramuscular route | Left Deltoid | lot: L-42 | exp: 2027-01-31',
        vaccine: { id: '115', name: 'Tdap' },
        dose: '0.5',
        units: 'ml',
        route: '78421000',
        location: { code: '368208006', name: 'Left Deltoid' },
        manufacturer: 'Merck and Co., Inc.',
        instructions: 'After consent',
        cvx: '115',
        mvx: 'MSD',
        cptCodes: [{ code: '90715', display: 'Tdap' }],
        ndc: '00006-4681-00',
        lot: 'L-42',
        expDate: '2027-01-31',
      },
    });
    expect(result.current.quickPickDialogOpen).toBe(false);
  });

  it('overwrites the quick pick it is asked to replace', async () => {
    const { result } = renderHook(() => useImmunizationQuickPickManagement({ getValues: () => FORM }));

    await act(() => result.current.openQuickPickDialog());
    await act(() => result.current.onSaveAsQuickPick('qp-1'));

    expect(updateImmunizationQuickPick).toHaveBeenCalledWith(
      oystehrZambda,
      'qp-1',
      expect.objectContaining({ vaccine: { id: '115', name: 'Tdap' }, cvx: '115', mvx: 'MSD' })
    );
    expect(createImmunizationQuickPick).not.toHaveBeenCalled();
  });
});

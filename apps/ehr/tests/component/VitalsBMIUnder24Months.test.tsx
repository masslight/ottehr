import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ saveVitals: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'appointment-1' }) };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/api/api', () => ({ uploadDotVisionDocument: vi.fn() }));

vi.mock('src/features/visits/shared/components/vitals/hooks/useGetVitals', () => {
  const today = new Date().toISOString();
  const sameDayHeightAndWeight = {
    'vital-height': [{ field: 'vital-height', value: 68, lastUpdated: today }],
    'vital-weight': [{ field: 'vital-weight', value: 8.25, lastUpdated: today }],
  };
  return {
    useGetVitals: () => ({
      data: undefined,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({ data: sameDayHeightAndWeight }),
    }),
    useGetHistoricalVitals: () => ({ data: undefined }),
  };
});

vi.mock('src/features/visits/shared/components/vitals/hooks/useSaveVitals', () => ({
  useSaveVitals: () => mocks.saveVitals,
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useBatchSaveVitals', () => ({
  useBatchSaveVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useDeleteVitals', () => ({
  useDeleteVitals: () => vi.fn().mockResolvedValue(undefined),
}));

import { useVitalsManagement } from '../../src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import { useVitalsDraftStore } from '../../src/state/draft-data.store';

const savedFields = (): string[] => mocks.saveVitals.mock.calls.map(([dto]) => dto.field);

const saveWeight = async (bmiApplies: boolean): Promise<void> => {
  const { result } = renderHook(() => useVitalsManagement({ encounterId: 'enc-bmi-test', bmiApplies }));
  act(() => {
    result.current.fields.weight.localState.handleKgInput({
      target: { value: '8.25' },
    } as React.ChangeEvent<HTMLInputElement>);
  });
  await act(async () => {
    await result.current.fields.weight.save();
  });
};

describe('BMI when weight and height are saved', () => {
  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
    mocks.saveVitals.mockReset().mockResolvedValue(undefined);
  });

  it('is not saved for a patient under 24 months at the visit', async () => {
    await saveWeight(false);

    expect(savedFields()).toEqual(['vital-weight']);
  });

  it('is saved from 24 months', async () => {
    await saveWeight(true);

    expect(savedFields()).toEqual(['vital-weight', 'vital-bmi']);
  });
});

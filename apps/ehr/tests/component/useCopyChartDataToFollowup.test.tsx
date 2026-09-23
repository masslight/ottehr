import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyChartDataToFollowup } from '../../src/features/visits/shared/components/patient/useCopyChartDataToFollowup';
import {
  useExamObservationsInitializationStore,
  useExamObservationsStore,
} from '../../src/features/visits/shared/stores/appointment/exam-observations.store';
import {
  useRosObservationsInitializationStore,
  useRosObservationsStore,
} from '../../src/features/visits/shared/stores/appointment/ros-observations.store';

const getChartDataMock = vi.fn();
const saveChartDataMock = vi.fn();
const deleteChartDataMock = vi.fn();

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({
    getChartData: getChartDataMock,
    saveChartData: saveChartDataMock,
    deleteChartData: deleteChartDataMock,
  }),
}));

// The initial visit: a narrative under the swapped `chiefComplaint` key (the "HPI" checkbox) and
// one exam observation.
const SOURCE = {
  scoped: { chiefComplaint: { resourceId: 'src-cc', text: 'narrative' } },
  unscoped: { examObservations: [{ resourceId: 'src-hr', field: 'hr', value: true }] },
};

// The visit being converted, already documented: the same exam field plus one the initial visit
// never touched, and its own HPI narrative.
const TARGET = {
  scoped: { chiefComplaint: { resourceId: 'tgt-cc', text: 'typed on this visit' } },
  unscoped: {
    examObservations: [
      { resourceId: 'tgt-hr', field: 'hr', value: false },
      { resourceId: 'tgt-rr', field: 'rr', value: true },
    ],
  },
};

const chartDataByEncounter = (charts: Record<string, { scoped?: object; unscoped?: object }>): void => {
  getChartDataMock.mockImplementation(({ encounterId, requestedFields }: Record<string, unknown>) => {
    const chart = charts[encounterId as string] ?? {};
    return Promise.resolve((requestedFields ? chart.scoped : chart.unscoped) ?? {});
  });
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

type CopyInput = Parameters<ReturnType<typeof useCopyChartDataToFollowup>['mutateAsync']>[0];

const copy = async (input: CopyInput): Promise<void> => {
  const { result } = renderHook(() => useCopyChartDataToFollowup(), { wrapper });
  return result.current.mutateAsync(input);
};

describe('useCopyChartDataToFollowup', () => {
  beforeEach(() => {
    getChartDataMock.mockReset();
    saveChartDataMock.mockReset();
    saveChartDataMock.mockResolvedValue(undefined);
    deleteChartDataMock.mockReset();
    deleteChartDataMock.mockResolvedValue(undefined);
    chartDataByEncounter({ 'enc-source': SOURCE, 'enc-target': TARGET });
    // The state the chart left behind for the visit being converted.
    useExamObservationsStore.setState({ rr: { field: 'rr', value: true, resourceId: 'tgt-rr' } }, true);
    useExamObservationsInitializationStore.setState({ hasInitialData: true });
    useRosObservationsStore.setState({ 'ros-cough': { field: 'ros-cough', value: true, resourceId: 'tgt-ros' } }, true);
    useRosObservationsInitializationStore.setState({ hasInitialData: true });
  });

  describe('copying onto a freshly booked follow-up', () => {
    it('only reads the initial visit and creates new resources', async () => {
      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['historyOfPresentIllness', 'examObservations'],
      });

      // Two calls, both for the source: the scoped note fields and the unscoped chart.
      expect(getChartDataMock).toHaveBeenCalledTimes(2);
      expect(getChartDataMock.mock.calls.every((call) => call[0].encounterId === 'enc-source')).toBe(true);
      expect(saveChartDataMock).toHaveBeenCalledWith({
        encounterId: 'enc-target',
        chiefComplaint: { resourceId: undefined, text: 'narrative' },
        examObservations: [{ resourceId: undefined, field: 'hr', value: true }],
      });
      expect(deleteChartDataMock).not.toHaveBeenCalled();
    });
  });

  describe('overwriting an already-documented visit', () => {
    it('reads both charts and writes over the target resources', async () => {
      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['historyOfPresentIllness', 'examObservations'],
        overwriteExisting: true,
      });

      expect(getChartDataMock).toHaveBeenCalledTimes(4);
      expect(getChartDataMock.mock.calls.filter((call) => call[0].encounterId === 'enc-target')).toHaveLength(2);
      // Target ids on both payloads: save-chart-data PUTs over them instead of posting a second set.
      expect(saveChartDataMock).toHaveBeenCalledWith({
        encounterId: 'enc-target',
        chiefComplaint: { resourceId: 'tgt-cc', text: 'narrative' },
        examObservations: [{ resourceId: 'tgt-hr', field: 'hr', value: true }],
      });
    });

    it('deletes the target observations the copy had nothing to overwrite', async () => {
      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['examObservations'],
        overwriteExisting: true,
      });

      expect(deleteChartDataMock).toHaveBeenCalledWith({
        encounterId: 'enc-target',
        examObservations: [{ resourceId: 'tgt-rr', field: 'rr', value: true }],
      });
    });

    it('deletes only after the copy has landed', async () => {
      const order: string[] = [];
      saveChartDataMock.mockImplementation(async () => void order.push('save'));
      deleteChartDataMock.mockImplementation(async () => void order.push('delete'));

      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['examObservations'],
        overwriteExisting: true,
      });

      expect(order).toEqual(['save', 'delete']);
    });

    it('skips the delete when every target resource was overwritten', async () => {
      chartDataByEncounter({
        'enc-source': SOURCE,
        'enc-target': { ...TARGET, unscoped: { examObservations: [{ resourceId: 'tgt-hr', field: 'hr' }] } },
      });

      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['examObservations'],
        overwriteExisting: true,
      });

      expect(saveChartDataMock).toHaveBeenCalled();
      expect(deleteChartDataMock).not.toHaveBeenCalled();
    });

    it('surfaces a failed cleanup as a failed copy', async () => {
      // The two calls are separate transactions, so a delete failure leaves the copy in place with
      // leftovers. The caller reports it rather than claiming a clean conversion.
      deleteChartDataMock.mockRejectedValue(new Error('delete-chart-data blew up'));

      await expect(
        copy({
          sourceEncounterId: 'enc-source',
          targetEncounterId: 'enc-target',
          fields: ['examObservations'],
          overwriteExisting: true,
        })
      ).rejects.toThrow('delete-chart-data blew up');
      expect(saveChartDataMock).toHaveBeenCalled();
    });
  });

  describe('re-reading the sections held outside react-query', () => {
    it('clears the exam store so the chart re-reads it from the server', async () => {
      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['examObservations'],
        overwriteExisting: true,
      });

      expect(useExamObservationsStore.getState()).toEqual({});
      expect(useExamObservationsInitializationStore.getState().hasInitialData).toBe(false);
    });

    it('clears the ROS store so the chart re-reads it from the server', async () => {
      chartDataByEncounter({
        'enc-source': { unscoped: { rosObservations: [{ resourceId: 'src-ros', field: 'ros-fever', value: true }] } },
        'enc-target': { unscoped: { rosObservations: [{ resourceId: 'tgt-ros', field: 'ros-cough', value: true }] } },
      });

      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['rosObservations'],
        overwriteExisting: true,
      });

      expect(useRosObservationsStore.getState()).toEqual({});
      expect(useRosObservationsInitializationStore.getState().hasInitialData).toBe(false);
    });

    it('clears the store even when the cleanup fails', async () => {
      deleteChartDataMock.mockRejectedValue(new Error('delete-chart-data blew up'));

      await expect(
        copy({
          sourceEncounterId: 'enc-source',
          targetEncounterId: 'enc-target',
          fields: ['examObservations'],
          overwriteExisting: true,
        })
      ).rejects.toThrow();
      // The save landed, so the store is out of date whether or not the leftovers were swept.
      expect(useExamObservationsStore.getState()).toEqual({});
    });

    it('leaves both stores alone when neither section was copied', async () => {
      await copy({
        sourceEncounterId: 'enc-source',
        targetEncounterId: 'enc-target',
        fields: ['historyOfPresentIllness'],
        overwriteExisting: true,
      });

      expect(useExamObservationsStore.getState()).toHaveProperty('rr');
      expect(useRosObservationsStore.getState()).toHaveProperty('ros-cough');
    });
  });

  it('touches nothing when only server-side fields are selected', async () => {
    const { result } = renderHook(() => useCopyChartDataToFollowup(), { wrapper });
    await result.current.mutateAsync({
      sourceEncounterId: 'enc-source',
      targetEncounterId: 'enc-target',
      fields: ['diagnosis'],
      overwriteExisting: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getChartDataMock).not.toHaveBeenCalled();
    expect(saveChartDataMock).not.toHaveBeenCalled();
    expect(deleteChartDataMock).not.toHaveBeenCalled();
  });
});

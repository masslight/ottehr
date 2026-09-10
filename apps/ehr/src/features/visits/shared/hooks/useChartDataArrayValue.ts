import { enqueueSnackbar } from 'notistack';
import { SearchParams } from 'utils/lib/fhir/uri';
import { SaveableDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import {
  ChartDataResponse,
  useChartData,
  useDeleteChartData,
  useSaveChartData,
} from '../stores/appointment/appointment.store';
import { useChartFields } from './useChartFields';

type ChartDataArrayValueType = Pick<
  GetChartDataResponse,
  'episodeOfCare' | 'allergies' | 'medications' | 'conditions' | 'surgicalHistory'
>;

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer ElementType> ? ElementType : never;

const mapValueToLabel: Record<keyof ChartDataArrayValueType, string> = {
  episodeOfCare: 'known hospitalizations',
  allergies: 'known allergies',
  medications: 'current medications',
  conditions: 'medical conditions',
  surgicalHistory: 'surgical history',
};

export const useChartDataArrayValue = <
  T extends keyof ChartDataArrayValueType,
  K extends NonNullable<ChartDataArrayValueType[T]>,
>(
  name: T,
  reset?: () => void,
  customParams?: SearchParams,
  onRemoveCallback?: () => any
): {
  isLoading: boolean;
  onSubmit: (data: ElementType<K>) => Promise<boolean>;
  onRemove: (resourceId: string) => Promise<void>;
  values: K;
} => {
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { chartData, chartDataSetState } = useChartData();

  const {
    isLoading: isChartDataLoading,
    data: currentFieldData,
    setQueryCache,
  } = useChartFields({
    requestedFields: { [name]: customParams || {} },
    enabled: !!customParams,
  });

  const unscopedValues = ((chartData as ChartDataArrayValueType)?.[name] || []) as K & SaveableDTO[];
  const values = (customParams ? currentFieldData?.[name] || [] : unscopedValues) as K;

  // Both caches are patched from the save/delete response instead of re-running the unscoped chart's
  // many FHIR searches after every change. Each patch reads the cache's current value, so two responses
  // that land before a re-render both apply. The unscoped query is marked stale (not refetched) so the
  // next screen that mounts it still starts from the server.
  const patchCaches = (update: (current: SaveableDTO[]) => SaveableDTO[]): void => {
    if (customParams) {
      setQueryCache(
        (state) =>
          ({ [name]: update(((state as Record<string, unknown>)?.[name] ?? []) as SaveableDTO[]) }) as Partial<
            typeof state
          >
      );
    }
    chartDataSetState(
      (state) => {
        const current = ((state.chartData as ChartDataArrayValueType | undefined)?.[name] ?? []) as SaveableDTO[];
        const next = { [name]: update(current) } as Partial<ChartDataResponse>;
        return { chartData: { ...state.chartData, patientId: state.chartData?.patientId || '', ...next } };
      },
      { invalidateQueries: false }
    );
  };

  const onSubmit = (data: ElementType<K>): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      saveChartData(
        {
          [name]: [data],
        },
        {
          onSuccess: (data) => {
            const saved = (data.chartData[name] ?? []) as unknown as SaveableDTO[];
            patchCaches((current) => [...current, ...saved]);
            resolve(true);
          },
          onError: (error) => {
            enqueueSnackbar(`An error has occurred while adding ${mapValueToLabel[name]}. Please try again.`, {
              variant: 'error',
            });
            reject(error);
          },
        }
      );
      if (reset) {
        reset();
      }
    });
  };

  const onRemove = async (resourceId: string): Promise<void> => {
    const newState = (values as K & SaveableDTO[]).filter((value) => value.resourceId === resourceId);
    return deleteChartData(
      {
        [name]: newState,
      },
      {
        onSuccess: () => {
          patchCaches((current) => current.filter((value) => value.resourceId !== resourceId));
          onRemoveCallback?.();
        },
        onError: () => {
          enqueueSnackbar(`An error has occurred while deleting ${mapValueToLabel[name]}. Please try again.`, {
            variant: 'error',
          });
        },
      }
    );
  };

  return { isLoading: isSaveLoading || isDeleteLoading || isChartDataLoading, onSubmit, onRemove, values };
};

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
  const { chartData, setPartialChartData } = useChartData();

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
  // thirteen FHIR searches after every change. The unscoped query is marked stale (not refetched) so the
  // next screen that mounts it still starts from the server.
  const patchUnscopedChart = (next: SaveableDTO[]): void => {
    setPartialChartData({ [name]: next } as Partial<ChartDataResponse>, { invalidateQueries: false });
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
            if (customParams) {
              setQueryCache({
                [name]: [...((currentFieldData?.[name] || []) as unknown as SaveableDTO[]), ...saved],
              });
            }
            patchUnscopedChart([...unscopedValues, ...saved]);
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
          const withoutRemoved = (items: SaveableDTO[] | undefined): SaveableDTO[] =>
            (items || []).filter((value) => value.resourceId !== resourceId);
          if (customParams) {
            setQueryCache({
              [name]: withoutRemoved(currentFieldData?.[name] as unknown as SaveableDTO[] | undefined),
            });
          }
          patchUnscopedChart(withoutRemoved(unscopedValues));
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

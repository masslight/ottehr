import { enqueueSnackbar } from 'notistack';
import { GetChartDataResponse, SaveableDTO, SearchParams } from 'utils';
import { useChartData, useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
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
  const { chartData, refetch } = useChartData();

  const {
    isLoading: isChartDataLoading,
    data: currentFieldData,
    setQueryCache,
  } = useChartFields({
    requestedFields: { [name]: customParams || {} },
    enabled: !!customParams,
  });

  const values = (
    customParams ? currentFieldData?.[name] || [] : (chartData as ChartDataArrayValueType)?.[name] || []
  ) as K;

  const onSubmit = (data: ElementType<K>): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      saveChartData(
        {
          [name]: [data],
        },
        {
          onSuccess: async (data) => {
            if (customParams) {
              setQueryCache({
                [name]: [...(currentFieldData?.[name] || []), ...(data.chartData[name] as K)],
              });
            }

            await refetch();
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
        onSuccess: async (_data) => {
          if (customParams) {
            setQueryCache({
              [name]: ((currentFieldData?.[name] || []) as unknown as K & SaveableDTO[]).filter(
                (value) => value.resourceId !== resourceId
              ),
            });
          }

          await refetch();
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

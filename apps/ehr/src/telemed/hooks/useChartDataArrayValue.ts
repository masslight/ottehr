import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { GetChartDataResponse, SaveableDTO, SearchParams } from 'utils';
import { useChartData, useDeleteChartData, useSaveChartData } from '../state';

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
  const { setPartialChartData, chartData } = useChartData();

  const {
    isLoading: isChartDataLoading,
    chartData: currentFieldData,
    queryKey,
  } = useChartData({
    requestedFields: { [name]: customParams || {} },
    enabled: !!customParams,
    replaceStoreValues: true,
  });

  const queryClient = useQueryClient();
  const values = (customParams ? currentFieldData?.[name] || [] : chartData?.[name] || []) as K;

  const onSubmit = (data: ElementType<K>): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      saveChartData(
        {
          [name]: [data],
        },
        {
          onSuccess: (data) => {
            setPartialChartData({
              [name]: [...values, ...(data.chartData[name] as K)],
            });

            queryClient.setQueryData<typeof currentFieldData>(queryKey, (oldData) => ({
              ...oldData!,
              [name]: [...values, ...(data.chartData[name] as K)],
            }));

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
        onSuccess: (_data) => {
          setPartialChartData({
            [name]: (values as K & SaveableDTO[]).filter((value) => value.resourceId !== resourceId),
          });
          queryClient.setQueryData<typeof currentFieldData>(queryKey, (oldData) => ({
            ...oldData!,
            [name]: (values as K & SaveableDTO[]).filter((value) => value.resourceId !== resourceId),
          }));
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

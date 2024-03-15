import { GetChartDataResponse, SaveableDTO } from 'ehr-utils';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../state';
import { getSelectors } from '../../shared/store/getSelectors';

type ChartDataArrayValueType = Pick<GetChartDataResponse, 'allergies' | 'medications' | 'conditions' | 'procedures'>;

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer ElementType> ? ElementType : never;

export const useChartDataArrayValue = <
  T extends keyof ChartDataArrayValueType,
  K extends NonNullable<ChartDataArrayValueType[T]>,
>(
  name: T,
  reset: () => void,
): {
  isLoading: boolean;
  onSubmit: (data: ElementType<K>) => void;
  onRemove: (resourceId: string) => void;
  values: K;
} => {
  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);

  const values = (chartData?.[name] || []) as K;

  const onSubmit = (data: ElementType<K>): void => {
    saveChartData(
      {
        [name]: [data],
      },
      {
        onSuccess: (data) => {
          setPartialChartData({
            [name]: [...values, ...(data[name] as K)],
          });
        },
      },
    );
    reset();
  };

  const onRemove = (resourceId: string): void => {
    const newState = (values as K & SaveableDTO[]).filter((value) => value.resourceId === resourceId);
    deleteChartData(
      {
        [name]: newState,
      },
      {
        onSuccess: (_data) => {
          setPartialChartData({
            [name]: (values as K & SaveableDTO[]).filter((value) => value.resourceId !== resourceId),
          });
        },
      },
    );
  };

  return { isLoading: isSaveLoading || isDeleteLoading, onSubmit, onRemove, values };
};

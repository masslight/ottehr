import { ChartDataFields } from 'ehr-utils';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../state';
import { getSelectors } from '../../shared/store/getSelectors';
import { useRef } from 'react';

type ChartDataTextValueType = Pick<
  ChartDataFields,
  'chiefComplaint' | 'ros' | 'proceduresNote' | 'observations' | 'medicalDecision' | 'addendumNote'
>;

enum nameToTypeEnum {
  'chiefComplaint' = 'text',
  'ros' = 'text',
  'proceduresNote' = 'text',
  'observations' = 'text',
  'medicalDecision' = 'text',
  'addendumNote' = 'text',
}

export const useDebounceNotesField = <T extends keyof ChartDataTextValueType>(
  name: T
): { onValueChange: (text: string) => void; isLoading: boolean } => {
  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);

  const isLoading = isSaveLoading || isDeleteLoading;

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const onValueChange = (text: string): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    timeoutRef.current = setTimeout(() => {
      text = text.trim();
      const variables = {
        [name]: {
          resourceId: chartData?.[name]?.resourceId,
          [nameToTypeEnum[name]]: text,
        },
      };
      if (text) {
        saveChartData(variables, {
          onSuccess: (data) => {
            setPartialChartData({ [name]: data[name] });
          },
        });
      } else {
        deleteChartData(variables, {
          onSuccess: (_data) => {
            setPartialChartData({ [name]: undefined });
          },
        });
      }
    }, 500);
  };

  return { onValueChange, isLoading };
};

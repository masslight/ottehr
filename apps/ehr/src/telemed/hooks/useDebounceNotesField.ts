import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { ChartDataFields } from 'utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore, useDeleteChartData, useSaveChartData } from '../state';

type ChartDataTextValueType = Pick<
  ChartDataFields,
  'chiefComplaint' | 'ros' | 'surgicalHistoryNote' | 'medicalDecision' | 'addendumNote'
>;

const nameToTypeEnum = {
  chiefComplaint: 'text',
  ros: 'text',
  surgicalHistoryNote: 'text',
  medicalDecision: 'text',
  addendumNote: 'text',
} as const;

const mapValueToLabel: Record<keyof ChartDataTextValueType, string> = {
  chiefComplaint: 'HPI note',
  ros: 'ROS note',
  surgicalHistoryNote: 'Surgical history note',
  medicalDecision: 'Medical Decision Making note',
  addendumNote: 'Addendum note',
};

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
            setPartialChartData({ [name]: data.chartData[name] });
          },
          onError: () => {
            enqueueSnackbar(`${mapValueToLabel[name]} field was not saved. Please change it's value to try again.`, {
              variant: 'error',
            });
          },
        });
      } else {
        deleteChartData(variables, {
          onSuccess: (_data) => {
            setPartialChartData({ [name]: undefined });
          },
          onError: () => {
            enqueueSnackbar(`${mapValueToLabel[name]} field was not saved. Please change it's value to try again.`, {
              variant: 'error',
            });
          },
        });
      }
    }, 500);
  };

  return { onValueChange, isLoading };
};

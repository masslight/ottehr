import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { ChartDataFields } from 'utils';
import { useChartData, useDeleteChartData, useSaveChartData } from '../state';

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

const requestedFieldsOptions: Partial<Record<keyof ChartDataTextValueType, { _tag?: string }>> = {
  chiefComplaint: { _tag: 'chief-complaint' },
  ros: { _tag: 'ros' },
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  medicalDecision: { _tag: 'medical-decision' },
  addendumNote: {},
};

export const useDebounceNotesField = <T extends keyof ChartDataTextValueType>(
  name: T
): { onValueChange: (text: string) => void; isLoading: boolean; isChartDataLoading: boolean } => {
  const { chartData, setPartialChartData } = useChartData();
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const { isLoading: isChartDataLoading } = useChartData({
    requestedFields: {
      [name]: requestedFieldsOptions[name],
    },
    onSuccess: (data) => {
      if (!data) return;
      setPartialChartData({ [name]: data[name] });
    },
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isLoading = isSaveLoading || isDeleteLoading;

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
        setPartialChartData({ [name]: undefined });
        deleteChartData(variables, {
          onError: () => {
            enqueueSnackbar(`${mapValueToLabel[name]} field was not saved. Please change it's value to try again.`, {
              variant: 'error',
            });
          },
        });
      }
    }, 700);
  };

  return { onValueChange, isLoading, isChartDataLoading };
};

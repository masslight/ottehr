import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { AllChartValues, ChartDataRequestedFields } from 'utils';
import { useChartFields, useDeleteChartData, useSaveChartData } from '../state';

type ChartDataTextValueType = Pick<
  AllChartValues,
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
  chiefComplaint: { _tag: 'chief-complaint' }, // todo: check if it can retrieve from useChartData
  ros: { _tag: 'ros' }, // todo: check if it can retrieve from useChartData
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  medicalDecision: { _tag: 'medical-decision' },
  addendumNote: {},
};

export const useDebounceNotesField = <T extends keyof ChartDataRequestedFields>(
  name: T
): { onValueChange: (text: string) => void; isLoading: boolean; isChartDataLoading: boolean } => {
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const {
    isLoading: isChartDataLoading,
    data: chartFields,
    setQueryCache,
  } = useChartFields({
    requestedFields: {
      [name]: requestedFieldsOptions[name as keyof ChartDataTextValueType],
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
          resourceId: (chartFields?.[name] as any)?.resourceId,
          [nameToTypeEnum[name as keyof ChartDataTextValueType]]: text,
        },
      };
      if (text) {
        saveChartData(variables, {
          onSuccess: (data) => {
            setQueryCache({ [name]: data.chartData[name] });
          },
          onError: () => {
            enqueueSnackbar(
              `${
                mapValueToLabel[name as keyof ChartDataTextValueType]
              } field was not saved. Please change it's value to try again.`,
              {
                variant: 'error',
              }
            );
          },
        });
      } else {
        setQueryCache({ [name]: undefined });
        deleteChartData(variables, {
          onError: () => {
            enqueueSnackbar(
              `${
                mapValueToLabel[name as keyof ChartDataTextValueType]
              } field was not saved. Please change it's value to try again.`,
              {
                variant: 'error',
              }
            );
          },
        });
      }
    }, 700);
  };

  return { onValueChange, isLoading, isChartDataLoading };
};

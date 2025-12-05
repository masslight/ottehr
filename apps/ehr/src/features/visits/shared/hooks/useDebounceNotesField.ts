import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { AllChartValues, GetChartDataResponse } from 'utils';
import { useChartData, useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import { useChartFields } from './useChartFields';

type ChartDataTextValueType = Pick<
  AllChartValues,
  | 'chiefComplaint'
  | 'mechanismOfInjury'
  | 'ros'
  | 'surgicalHistoryNote'
  | 'medicalDecision'
  | 'addendumNote'
  | 'historyOfPresentIllness'
>;

const nameToTypeEnum = {
  chiefComplaint: 'text',
  mechanismOfInjury: 'text',
  ros: 'text',
  surgicalHistoryNote: 'text',
  medicalDecision: 'text',
  addendumNote: 'text',
  historyOfPresentIllness: 'text',
} as const;

const mapValueToLabel: Record<keyof ChartDataTextValueType, string> = {
  chiefComplaint: 'Chief complaint note',
  mechanismOfInjury: 'Mechanism of injury note',
  ros: 'ROS note',
  surgicalHistoryNote: 'Surgical history note',
  medicalDecision: 'Medical Decision Making note',
  addendumNote: 'Addendum note',
  historyOfPresentIllness: 'HPI note',
};

const requestedFieldsOptions: Partial<Record<keyof ChartDataTextValueType, { _tag?: string }>> = {
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  ros: { _tag: 'ros' },
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  medicalDecision: { _tag: 'medical-decision' },
  addendumNote: {},
};

export const useDebounceNotesField = <T extends keyof ChartDataTextValueType>(
  name: T
): {
  onValueChange: (
    text: string,
    {
      refetchChartDataOnSave,
      additionalRequestOptions,
    }?: { refetchChartDataOnSave: boolean; additionalRequestOptions?: { createICDRecommendations?: boolean } }
  ) => void;
  isLoading: boolean;
  isChartDataLoading: boolean;
  hasPendingApiRequests: boolean; // we can use it later to prevent navigation if there are pending api requests
} => {
  const { refetch } = useChartData();
  const {
    isLoading: isChartDataLoading,
    data: chartFields,
    setQueryCache,
  } = useChartFields({
    requestedFields: {
      [name]: requestedFieldsOptions[name as keyof ChartDataTextValueType],
    },
  });

  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const isLoading = isSaveLoading || isDeleteLoading;

  // timer for debounce user type
  const inputDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // timer for debounce api calls
  const apiDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // flag to track if there are any api requests in progress
  const hasPendingApiRequestsRef = useRef(false);

  // actual value from server
  const latestValueFromServerRef = useRef<GetChartDataResponse[T] | undefined>();

  // actual value from user, the latest text typed into the input
  const latestValueFromUserRef = useRef<string>('');

  const onValueChange = (
    text: string,
    {
      refetchChartDataOnSave,
      additionalRequestOptions,
    }: { refetchChartDataOnSave?: boolean; additionalRequestOptions?: { createICDRecommendations?: boolean } } = {}
  ): void => {
    latestValueFromUserRef.current = text.trim();

    if (inputDebounceRef.current) {
      clearTimeout(inputDebounceRef.current);
    }

    inputDebounceRef.current = setTimeout(() => {
      if (hasPendingApiRequestsRef.current) {
        clearTimeout(apiDebounceRef.current);

        apiDebounceRef.current = setTimeout(() => {
          onValueChange(latestValueFromUserRef.current);
        }, 500);

        // need to handle current api call first
        return;
      }

      hasPendingApiRequestsRef.current = true;

      const variables = {
        [name]: {
          resourceId:
            (chartFields?.[name] as GetChartDataResponse[T])?.resourceId ||
            latestValueFromServerRef.current?.resourceId,
          [nameToTypeEnum[name]]: latestValueFromUserRef.current,
          ...additionalRequestOptions,
        },
      };

      if (latestValueFromUserRef.current) {
        saveChartData(variables, {
          onSuccess: (data) => {
            const valueToSave = data.chartData[name];

            // skip ui update if value was changed, we need to set only actual value
            if (latestValueFromUserRef.current === valueToSave?.[nameToTypeEnum[name]]) {
              setQueryCache({ [name]: valueToSave });
            }

            if (refetchChartDataOnSave) {
              // refetch chart data
              refetch()
                .then(() => console.log('Successfully re-fetched'))
                .catch(() => console.log('Error refetching'));
            }

            hasPendingApiRequestsRef.current = false;
            latestValueFromServerRef.current = valueToSave;
          },
          onError: () => {
            enqueueSnackbar(`${mapValueToLabel[name]} field was not saved. Please change it's value to try again.`, {
              variant: 'error',
            });
            hasPendingApiRequestsRef.current = false;
          },
        });
      } else {
        deleteChartData(variables, {
          onSuccess: () => {
            // skip ui update if value was changed, we need to set only actual value
            if (latestValueFromUserRef.current === '') {
              setQueryCache({ [name]: undefined });
            }

            hasPendingApiRequestsRef.current = false;
            latestValueFromServerRef.current = undefined;
          },
          onError: () => {
            enqueueSnackbar(`${mapValueToLabel[name]} field was not saved. Please change it's value to try again.`, {
              variant: 'error',
            });
            hasPendingApiRequestsRef.current = false;
          },
        });
      }
    }, 500);
  };

  return { onValueChange, isLoading, isChartDataLoading, hasPendingApiRequests: hasPendingApiRequestsRef.current };
};

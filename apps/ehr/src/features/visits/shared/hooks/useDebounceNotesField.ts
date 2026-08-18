import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
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
  | 'reasonForVisit'
>;

const nameToTypeEnum = {
  chiefComplaint: 'text',
  mechanismOfInjury: 'text',
  ros: 'text',
  surgicalHistoryNote: 'text',
  medicalDecision: 'text',
  addendumNote: 'text',
  historyOfPresentIllness: 'text',
  reasonForVisit: 'text',
} as const;

const mapValueToLabel: Record<keyof ChartDataTextValueType, string> = {
  chiefComplaint: 'Chief complaint note',
  mechanismOfInjury: 'Mechanism of injury note',
  ros: 'ROS note',
  surgicalHistoryNote: 'Surgical history note',
  medicalDecision: 'Medical Decision Making note',
  addendumNote: 'Addendum note',
  historyOfPresentIllness: 'HPI note',
  reasonForVisit: 'Reason for visit',
};

const requestedFieldsOptions: Partial<Record<keyof ChartDataTextValueType, { _tag?: string }>> = {
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  ros: { _tag: 'ros' },
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  medicalDecision: { _tag: 'medical-decision' },
  addendumNote: {},
  reasonForVisit: {},
};

export interface UseDebounceNotesFieldOptions {
  /**
   * Read and write this encounter instead of resolving one from the appointment store.
   *
   * The in-person pages pass nothing and keep reading the store. A page keyed by ENCOUNTER has no
   * appointment there, so without this the field's own id is undefined: the read never enables and the
   * save throws. Explicit id first, store fallback — the shape `useSaveChartData` already takes.
   */
  encounterId?: string;
  /**
   * Called after a save or delete lands. `refetchChartDataOnSave` refetches the APPOINTMENT STORE's
   * chart query, which a page that does not populate the store has no use for — it needs its own query
   * refreshed instead.
   */
  onSaved?: () => void;
}

export const useDebounceNotesField = <T extends keyof ChartDataTextValueType>(
  name: T,
  { encounterId, onSaved }: UseDebounceNotesFieldOptions = {}
): {
  onValueChange: (text: string, { refetchChartDataOnSave }?: { refetchChartDataOnSave: boolean }) => void;
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
    encounterId,
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

  const onValueChange = (text: string, { refetchChartDataOnSave }: { refetchChartDataOnSave?: boolean } = {}): void => {
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
        // Undefined keeps the store fallback, so the in-person pages are unaffected.
        encounterId,
        [name]: {
          resourceId:
            (chartFields?.[name] as GetChartDataResponse[T])?.resourceId ||
            latestValueFromServerRef.current?.resourceId,
          [nameToTypeEnum[name]]: latestValueFromUserRef.current,
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
            onSaved?.();
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
            onSaved?.();

            if (refetchChartDataOnSave) {
              // refetch chart data
              refetch()
                .then(() => console.log('Successfully re-fetched'))
                .catch(() => console.log('Error refetching'));
            }
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

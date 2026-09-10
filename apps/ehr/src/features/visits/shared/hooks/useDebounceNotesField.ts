import { enqueueSnackbar } from 'notistack';
import { useRef } from 'react';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { EncounterNotesSectionData } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import { useChartSection } from './useChartSection';

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

/**
 * Debounced save of one of the visit's free-text fields. All of them live in the encounterNotes section,
 * whose cache entry is patched with what the server returned, so every reader of the field sees the saved
 * value without another request.
 */
export const useDebounceNotesField = <T extends keyof ChartDataTextValueType>(
  name: T
): {
  onValueChange: (text: string) => void;
  isLoading: boolean;
  isChartDataLoading: boolean;
  hasPendingApiRequests: boolean; // we can use it later to prevent navigation if there are pending api requests
} => {
  const { isLoading: isChartDataLoading, data: encounterNotes, setSectionData } = useChartSection('encounterNotes');

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
  const latestValueFromServerRef = useRef<EncounterNotesSectionData[T] | undefined>();

  // actual value from user, the latest text typed into the input
  const latestValueFromUserRef = useRef<string>('');

  const onValueChange = (text: string): void => {
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
          resourceId: encounterNotes?.[name]?.resourceId || latestValueFromServerRef.current?.resourceId,
          [nameToTypeEnum[name]]: latestValueFromUserRef.current,
        },
      };

      if (latestValueFromUserRef.current) {
        saveChartData(variables, {
          onSuccess: (data) => {
            const valueToSave = data.chartData[name] as EncounterNotesSectionData[T];

            // skip ui update if value was changed, we need to set only actual value
            if (latestValueFromUserRef.current === valueToSave?.[nameToTypeEnum[name]]) {
              setSectionData({ [name]: valueToSave } as Partial<EncounterNotesSectionData>);
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
              setSectionData({ [name]: undefined } as Partial<EncounterNotesSectionData>);
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

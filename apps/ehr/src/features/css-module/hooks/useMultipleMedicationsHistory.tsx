import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { QueryObserverResult } from 'react-query';
import { ChartDataFieldsKeys, GetChartDataResponse, MedicationDTO, SearchParams } from 'utils';
import { useMedicationHistory } from './useMedicationHistory';

type MedicationHistoryField = Extract<ChartDataFieldsKeys, 'medications' | 'inhouseMedications'>;

type MedicationHistoryFields = Record<MedicationHistoryField, { data: MedicationDTO[]; isLoading: boolean }>;

type RefetchFunctions = Record<
  MedicationHistoryField,
  () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>
>;

type MedicationAction =
  | {
      type: 'UPDATE_FIELD';
      field: MedicationHistoryField;
      data: { data: MedicationDTO[]; isLoading: boolean };
    }
  | {
      type: 'UPDATE_REFETCH';
      field: MedicationHistoryField;
      refetch: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>;
    };

export interface MedicationWithTypeDTO extends MedicationDTO {
  chartDataField: MedicationHistoryField;
}

/**
 * Good to know:
 * When multiple setState calls happen in the same React batch, they receive the same
 * `prev` state snapshot, causing only the last update to be applied. For object-structured
 * state with asynchronous partial updates, use useReducer (which guarantees each operation
 * executes) or a state manager instead of useState.
 */
const medicationReducer = (
  state: { medicationData: MedicationHistoryFields; refetchFunctions: RefetchFunctions },
  action: MedicationAction
): { medicationData: MedicationHistoryFields; refetchFunctions: RefetchFunctions } => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        medicationData: {
          ...state.medicationData,
          [action.field]: action.data,
        },
      };
    case 'UPDATE_REFETCH':
      return {
        ...state,
        refetchFunctions: {
          ...state.refetchFunctions,
          [action.field]: action.refetch,
        },
      };
    default:
      return state;
  }
};

/**
 * Combines medication data from multiple sources into a single
 * sorted history list. Returns React components that must be rendered to fetch the data due to
 * conditional hook call restrictions.
 */
export const useMultipleMedicationsHistory = (
  fields: MedicationHistoryField[],
  search_by: SearchParams['_search_by'] = 'encounter',
  count = 10
): {
  componentsForDataFetching: React.ReactNode[];
  isLoading: boolean;
  medicationHistory: MedicationWithTypeDTO[];
  refetchHistory: () => Promise<void>;
} => {
  const [state, dispatch] = useReducer(medicationReducer, {
    medicationData: {} as MedicationHistoryFields,
    refetchFunctions: {} as RefetchFunctions,
  });

  const handleDataUpdate = useCallback((field: MedicationHistoryField, data: MedicationDTO[], isLoading: boolean) => {
    dispatch({
      type: 'UPDATE_FIELD',
      field,
      data: { data, isLoading },
    });
  }, []);

  const handleRefetchUpdate = useCallback(
    (field: MedicationHistoryField, refetch: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>) => {
      dispatch({
        type: 'UPDATE_REFETCH',
        field,
        refetch,
      });
    },
    []
  );

  const combinedMedicationHistory: MedicationWithTypeDTO[] = useMemo(() => {
    const allMedications: MedicationWithTypeDTO[] = [];

    fields.forEach((field) => {
      const fieldData = state.medicationData[field];
      if (fieldData?.data) {
        const medicationsWithType: MedicationWithTypeDTO[] = fieldData.data.map((medication) => ({
          ...medication,
          chartDataField: field,
        }));
        allMedications.push(...medicationsWithType);
      }
    });

    return allMedications.sort((a, b) => {
      const FALLBACK_DATE = 0; // move items without date to the end of the list
      const dateA = a?.intakeInfo.date ? new Date(a.intakeInfo.date) : FALLBACK_DATE;
      const dateB = b?.intakeInfo.date ? new Date(b.intakeInfo.date) : FALLBACK_DATE;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [state.medicationData, fields]);

  const isLoading = useMemo(() => {
    return fields.some((field) => state.medicationData[field]?.isLoading ?? true);
  }, [state.medicationData, fields]);

  const refetchHistory = useCallback(async () => {
    const promises = fields.map((field) => {
      const refetchFn = state.refetchFunctions[field];
      return refetchFn ? refetchFn() : Promise.resolve();
    });

    await Promise.all(promises);
  }, [fields, state.refetchFunctions]);

  const componentsForDataFetching = useMemo(
    () =>
      fields.map((field) => {
        return (
          <MedicationFieldLoader
            key={field}
            field={field}
            search_by={search_by}
            count={count}
            onDataUpdate={handleDataUpdate}
            onRefetchUpdate={handleRefetchUpdate}
          />
        );
      }),
    [fields, search_by, count, handleDataUpdate, handleRefetchUpdate]
  );

  return {
    componentsForDataFetching,
    isLoading,
    medicationHistory: combinedMedicationHistory,
    refetchHistory,
  };
};

const MedicationFieldLoader: React.FC<{
  field: MedicationHistoryField;
  search_by: SearchParams['_search_by'];
  count: number;
  onDataUpdate: (field: MedicationHistoryField, data: MedicationDTO[], isLoading: boolean) => void;
  onRefetchUpdate: (
    field: MedicationHistoryField,
    refetch: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>
  ) => void;
}> = ({ field, search_by, count, onDataUpdate, onRefetchUpdate }) => {
  const { isLoading, medicationHistory, refetchHistory } = useMedicationHistory(search_by, count, field);

  useEffect(() => {
    onDataUpdate(field, medicationHistory, isLoading);
  }, [field, medicationHistory, isLoading, onDataUpdate]);

  useEffect(() => {
    onRefetchUpdate(field, refetchHistory);
  }, [field, refetchHistory, onRefetchUpdate]);

  return null;
};

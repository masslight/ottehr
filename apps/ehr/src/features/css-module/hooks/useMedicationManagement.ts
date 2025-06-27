import { DateTime } from 'luxon';
import React, { useCallback, useMemo } from 'react';
import {
  ExtendedMedicationDataForResponse,
  MedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { MedicationOrderType } from '../components/medication-administration/medication-editable-card/fieldsConfig';
import { statusTransitions } from '../components/medication-administration/medicationTypes';
import { useMedicationAPI } from './useMedicationOperations';

export const useMedicationManagement = (): {
  medications: ExtendedMedicationDataForResponse[];
  getMedicationById: (id: string) => ExtendedMedicationDataForResponse | undefined;
  getAvailableStatuses: (currentStatus?: MedicationOrderStatusesType) => MedicationOrderStatusesType[];
  isValidStatusTransition: (
    currentStatus: MedicationOrderStatusesType,
    newStatus: MedicationOrderStatusesType
  ) => boolean;
  pendingMedications: ExtendedMedicationDataForResponse[];
  completedMedications: ExtendedMedicationDataForResponse[];
  canEditMedication: (medication: ExtendedMedicationDataForResponse) => boolean;
  warnings: (string | React.ReactElement)[];
  getMedicationFieldValue: <Field extends keyof MedicationData>(
    medication: MedicationData,
    field: Field,
    type?: string
  ) => MedicationData[Field] | '';
  loadMedications: () => Promise<void>;
  updateMedication: (updatedMedication: UpdateMedicationOrderInput) => Promise<{
    id: string;
    message: string;
  }>;
  deleteMedication: (idToDelete: string) => Promise<void>;
  getIsMedicationEditable: (type: MedicationOrderType, medication?: ExtendedMedicationDataForResponse) => boolean;
} => {
  const { medications, loadMedications, updateMedication, deleteMedication } = useMedicationAPI();
  const getMedicationById = useCallback((id: string) => medications?.find((med) => med.id === id), [medications]);

  const getIsMedicationEditable = (
    type: MedicationOrderType,
    medication?: ExtendedMedicationDataForResponse
  ): boolean => {
    return {
      'order-new': true,
      'order-edit': medication?.status === 'pending',
      dispense: medication?.status === 'pending',
      'dispense-not-administered': medication?.status === 'pending',
    }[type];
  };

  const getAvailableStatuses = useCallback(
    (currentStatus?: MedicationOrderStatusesType): MedicationOrderStatusesType[] => {
      return statusTransitions[currentStatus as MedicationOrderStatusesType] || [];
    },
    []
  );

  const isValidStatusTransition = useCallback(
    (currentStatus: MedicationOrderStatusesType, newStatus: MedicationOrderStatusesType): boolean => {
      return getAvailableStatuses(currentStatus).includes(newStatus);
    },
    [getAvailableStatuses]
  );

  const pendingMedications = useMemo(() => medications?.filter?.((med) => med.status === 'pending'), [medications]);

  const completedMedications = useMemo(() => medications?.filter?.((med) => med.status !== 'pending'), [medications]);

  const formatDate = useCallback((dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = DateTime.fromISO(dateString);
    return date.isValid ? date.toFormat('yyyy-MM-dd') : '';
  }, []);

  const formatTime = useCallback((timeString: string | undefined): string => {
    if (!timeString) return '';
    const time = DateTime.fromFormat(timeString, 'h:mm a');
    return time.isValid ? time.toFormat('HH:mm') : '';
  }, []);

  const canEditMedication = useCallback((medication: ExtendedMedicationDataForResponse): boolean => {
    return medication.status === 'pending';
  }, []);

  const warnings = useMemo((): (string | React.ReactElement)[] => {
    // TODO: add allergy warnings
    return [];
  }, []);

  const getMedicationFieldValue = useCallback(
    <Field extends keyof MedicationData>(
      medication: MedicationData,
      field: Field,
      type?: string
    ): MedicationData[Field] | '' => {
      const value = medication[field];
      if (type === 'date') {
        return formatDate(value as string) as MedicationData[Field];
      } else if (type === 'time') {
        return formatTime(value as string) as MedicationData[Field];
      }
      return (value as MedicationData[Field]) || '';
    },
    [formatDate, formatTime]
  );

  return {
    medications,
    getMedicationById,
    updateMedication,
    deleteMedication,
    getAvailableStatuses,
    isValidStatusTransition,
    pendingMedications,
    completedMedications,
    canEditMedication,
    warnings,
    getMedicationFieldValue,
    loadMedications,
    getIsMedicationEditable,
  };
};

import { DateTime } from 'luxon';
import { useCallback, useState } from 'react';
import { VitalFieldNames, VitalsLastMenstrualPeriodObservationDTO } from 'utils';
import { LMPLocalState } from '../types';

export function useLMPLocalState(): LMPLocalState {
  const [selectedDate, setSelectedDate] = useState<DateTime | null>(null);
  const [isUnsureOptionSelected, setIsUnsureOptionSelected] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<boolean>(false);

  const handleDateChange = useCallback((date: DateTime | null): void => {
    setSelectedDate(date);
    setValidationError(false);
  }, []);

  const handleUnsureChange = useCallback((isChecked: boolean): void => {
    setIsUnsureOptionSelected(isChecked);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setSelectedDate(null);
    setIsUnsureOptionSelected(false);
  }, []);

  const getDTO = useCallback((): VitalsLastMenstrualPeriodObservationDTO | null => {
    if (!selectedDate) return null;
    return {
      field: VitalFieldNames.VitalLastMenstrualPeriod,
      value: selectedDate.toISODate() ?? '',
      isUnsure: isUnsureOptionSelected,
    };
  }, [selectedDate, isUnsureOptionSelected]);

  const hasData = selectedDate !== null || isUnsureOptionSelected;
  const isValid = getDTO() !== null;
  const isDisabled = !selectedDate;
  const isDateInvalid = !selectedDate && isUnsureOptionSelected;

  return {
    selectedDate,
    isUnsureSelected: isUnsureOptionSelected,
    validationError,
    isDateInvalid,
    isDisabled,
    hasData,
    isValid,
    handleDateChange,
    handleUnsureChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

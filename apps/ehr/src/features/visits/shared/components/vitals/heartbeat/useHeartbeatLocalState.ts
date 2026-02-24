import { ChangeEvent, useCallback, useState } from 'react';
import { toVitalHeartbeatObservationMethod, VitalFieldNames, VitalsHeartbeatObservationDTO } from 'utils';
import { textToHeartbeatNumber } from './helpers';

export interface HeartbeatLocalState {
  value: string;
  observationQualifier: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleValueChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleQualifierChange: (qualifier: string) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsHeartbeatObservationDTO | null;
}

export function useHeartbeatLocalState(): HeartbeatLocalState {
  const [heartbeatValueText, setHeartbeatValueText] = useState('');
  const [observationQualifier, setObservationsQualifier] = useState<string>('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleValueChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const hrAsText = e.target.value;
    setHeartbeatValueText(hrAsText);
    setValidationError(false);
  }, []);

  const handleQualifierChange = useCallback((qualifier: string): void => {
    setObservationsQualifier(qualifier);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setHeartbeatValueText('');
    setObservationsQualifier('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsHeartbeatObservationDTO | null => {
    const heartbeatValueNumber = textToHeartbeatNumber(heartbeatValueText);
    if (!heartbeatValueNumber) return null;
    return {
      field: VitalFieldNames.VitalHeartbeat,
      value: heartbeatValueNumber,
      observationMethod: toVitalHeartbeatObservationMethod(observationQualifier),
    };
  }, [heartbeatValueText, observationQualifier]);

  const hasData = heartbeatValueText.length > 0 || observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !heartbeatValueText;

  return {
    value: heartbeatValueText,
    observationQualifier,
    validationError: isValidationError,
    isDisabled,
    hasData,
    isValid,
    handleValueChange,
    handleQualifierChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

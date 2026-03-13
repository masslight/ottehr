import { ChangeEvent, useCallback, useState } from 'react';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  toVitalTemperatureObservationMethod,
  VitalFieldNames,
  VitalsTemperatureObservationDTO,
} from 'utils';
import { TemperatureLocalState } from '../types';
import { textToTemperatureNumber } from './helpers';

export function useTemperatureLocalState(): TemperatureLocalState {
  const [temperatureValueText, setTemperatureValueText] = useState('');
  const [temperatureValueTextFahrenheit, setTemperatureValueTextFahrenheit] = useState('');
  const [observationQualifier, setObservationsQualifier] = useState<string>('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleCelsiusChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const tempAsText = e.target.value;
    setTemperatureValueText(tempAsText);
    const tempAsNumber = textToTemperatureNumber(tempAsText);
    setTemperatureValueTextFahrenheit(tempAsNumber ? celsiusToFahrenheit(tempAsNumber).toString() : '');
    setValidationError(false);
  }, []);

  const handleFahrenheitChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const tempAsText = e.target.value;
    setTemperatureValueTextFahrenheit(tempAsText);
    const tempAsNumber = textToTemperatureNumber(tempAsText);
    setTemperatureValueText(tempAsNumber ? fahrenheitToCelsius(tempAsNumber).toString() : '');
    setValidationError(false);
  }, []);

  const handleQualifierChange = useCallback((qualifier: string): void => {
    setObservationsQualifier(qualifier);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setTemperatureValueText('');
    setTemperatureValueTextFahrenheit('');
    setObservationsQualifier('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsTemperatureObservationDTO | null => {
    const temperatureValueNumber = textToTemperatureNumber(temperatureValueText);
    if (temperatureValueNumber === undefined) return null;
    return {
      field: VitalFieldNames.VitalTemperature,
      value: temperatureValueNumber,
      observationMethod: toVitalTemperatureObservationMethod(observationQualifier),
    };
  }, [temperatureValueText, observationQualifier]);

  const hasData = temperatureValueText.length > 0 || observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !temperatureValueText;

  const isCelsiusInvalid = ((): boolean => {
    if (temperatureValueText.length > 0) {
      return !textToTemperatureNumber(temperatureValueText);
    }
    return observationQualifier.length > 0;
  })();

  const isFahrenheitInvalid = ((): boolean => {
    if (temperatureValueTextFahrenheit.length > 0) {
      return !textToTemperatureNumber(temperatureValueTextFahrenheit);
    }
    return observationQualifier.length > 0;
  })();

  return {
    valueCelsius: temperatureValueText,
    valueFahrenheit: temperatureValueTextFahrenheit,
    observationQualifier,
    validationError: isValidationError,
    isCelsiusInvalid,
    isFahrenheitInvalid,
    isDisabled,
    hasData,
    isValid,
    handleCelsiusChange,
    handleFahrenheitChange,
    handleQualifierChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

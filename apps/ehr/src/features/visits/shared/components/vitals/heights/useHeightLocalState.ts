import { ChangeEvent, useCallback, useState } from 'react';
import { VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import {
  heightCmToFeetText,
  heightCmToInchesText,
  textToHeightNumber,
  textToHeightNumberFromFeet,
  textToHeightNumberFromInches,
} from './helpers';

export interface HeightLocalState {
  valueCm: string;
  valueInches: string;
  valueFeet: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleCmChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleInchesChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleFeetChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsHeightObservationDTO | null;
}

export function useHeightLocalState(): HeightLocalState {
  const [heightValueTextCm, setHeightValueTextCm] = useState('');
  const [heightValueTextInches, setHeightValueTextInches] = useState('');
  const [heightValueTextFeet, setHeightValueTextFeet] = useState('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleCmChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const cmAsText = e.target.value;
    setValidationError(false);
    setHeightValueTextCm(cmAsText);
    const heightCm = textToHeightNumber(cmAsText);
    if (heightCm) {
      const inchesText = heightCmToInchesText(heightCm);
      setHeightValueTextInches(inchesText);

      const feetText = heightCmToFeetText(heightCm);
      setHeightValueTextFeet(feetText);
    } else {
      setHeightValueTextInches('');
      setHeightValueTextFeet('');
    }
  }, []);

  const handleInchesChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const inchesAsText = e.target.value;
    setValidationError(false);
    setHeightValueTextInches(inchesAsText);
    const heightCm = textToHeightNumberFromInches(inchesAsText);
    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());

      const feetText = heightCmToFeetText(heightCm);
      setHeightValueTextFeet(feetText);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextFeet('');
    }
  }, []);

  const handleFeetChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const feetAsText = e.target.value;
    setValidationError(false);
    setHeightValueTextFeet(feetAsText);

    const heightCm = textToHeightNumberFromFeet(feetAsText);

    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());

      const inchesText = heightCmToInchesText(heightCm);
      setHeightValueTextInches(inchesText);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextInches('');
    }
  }, []);

  const clearForm = useCallback(() => {
    setHeightValueTextCm('');
    setHeightValueTextInches('');
    setHeightValueTextFeet('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsHeightObservationDTO | null => {
    let heightValueNumber: number | undefined;
    if (heightValueTextCm) {
      heightValueNumber = textToHeightNumber(heightValueTextCm);
    } else if (heightValueTextInches) {
      heightValueNumber = textToHeightNumberFromInches(heightValueTextInches);
    } else if (heightValueTextFeet) {
      heightValueNumber = textToHeightNumberFromFeet(heightValueTextFeet);
    }
    if (!heightValueNumber) return null;
    return {
      field: VitalFieldNames.VitalHeight,
      value: heightValueNumber,
    };
  }, [heightValueTextCm, heightValueTextInches, heightValueTextFeet]);

  const hasData = heightValueTextCm.length > 0 || heightValueTextInches.length > 0 || heightValueTextFeet.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !heightValueTextCm && !heightValueTextInches && !heightValueTextFeet;

  return {
    valueCm: heightValueTextCm,
    valueInches: heightValueTextInches,
    valueFeet: heightValueTextFeet,
    validationError: isValidationError,
    isDisabled,
    hasData,
    isValid,
    handleCmChange,
    handleInchesChange,
    handleFeetChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

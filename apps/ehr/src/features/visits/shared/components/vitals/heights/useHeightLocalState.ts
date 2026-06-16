import { ChangeEvent, useCallback, useState } from 'react';
import { cmToInches, heightCmToFeetInches, VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import { HeightLocalState } from '../types';
import {
  textToHeightNumber,
  textToHeightNumberFromFeetAndInchRemainder,
  textToHeightNumberFromInches,
} from './helpers';

export function useHeightLocalState(): HeightLocalState {
  const [heightValueTextCm, setHeightValueTextCm] = useState('');
  const [heightValueTextInches, setHeightValueTextInches] = useState('');
  const [heightValueTextFeet, setHeightValueTextFeet] = useState('');
  const [heightValueTextInchRemainder, setHeightValueTextInchRemainder] = useState('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleCmChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const cmAsText = e.target.value;
    setValidationError(false);
    setHeightValueTextCm(cmAsText);
    const heightCm = textToHeightNumber(cmAsText);
    if (heightCm) {
      const { totalInches, feet, inchRemainder } = heightCmToFeetInches(heightCm);
      setHeightValueTextInches(`${totalInches}`);
      setHeightValueTextFeet(`${feet}`);
      setHeightValueTextInchRemainder(`${inchRemainder}`);
    } else {
      setHeightValueTextInches('');
      setHeightValueTextFeet('');
      setHeightValueTextInchRemainder('');
    }
  }, []);

  const handleInchesChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const inchesAsText = e.target.value;
    setValidationError(false);
    setHeightValueTextInches(inchesAsText);
    const heightCm = textToHeightNumberFromInches(inchesAsText);
    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());
      const { feet, inchRemainder } = heightCmToFeetInches(heightCm);
      setHeightValueTextFeet(`${feet}`);
      setHeightValueTextInchRemainder(`${inchRemainder}`);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextFeet('');
      setHeightValueTextInchRemainder('');
    }
  }, []);

  const applyFeetAndInchRemainderToCm = useCallback((feetAsText: string, inchRemainderAsText: string): void => {
    const heightCm = textToHeightNumberFromFeetAndInchRemainder(feetAsText, inchRemainderAsText);
    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());
      setHeightValueTextInches(`${cmToInches(heightCm)}`);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextInches('');
    }
  }, []);

  const handleFeetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const feetAsText = e.target.value;
      setValidationError(false);
      setHeightValueTextFeet(feetAsText);
      applyFeetAndInchRemainderToCm(feetAsText, heightValueTextInchRemainder);
    },
    [applyFeetAndInchRemainderToCm, heightValueTextInchRemainder]
  );

  const handleInchRemainderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const inchRemainderAsText = e.target.value;
      setValidationError(false);
      setHeightValueTextInchRemainder(inchRemainderAsText);
      applyFeetAndInchRemainderToCm(heightValueTextFeet, inchRemainderAsText);
    },
    [applyFeetAndInchRemainderToCm, heightValueTextFeet]
  );

  const clearForm = useCallback(() => {
    setHeightValueTextCm('');
    setHeightValueTextInches('');
    setHeightValueTextFeet('');
    setHeightValueTextInchRemainder('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsHeightObservationDTO | null => {
    let heightValueNumber: number | undefined;
    if (heightValueTextCm) {
      heightValueNumber = textToHeightNumber(heightValueTextCm);
    } else if (heightValueTextInches) {
      heightValueNumber = textToHeightNumberFromInches(heightValueTextInches);
    } else if (heightValueTextFeet || heightValueTextInchRemainder) {
      heightValueNumber = textToHeightNumberFromFeetAndInchRemainder(heightValueTextFeet, heightValueTextInchRemainder);
    }
    if (!heightValueNumber) return null;
    return {
      field: VitalFieldNames.VitalHeight,
      value: heightValueNumber,
    };
  }, [heightValueTextCm, heightValueTextInches, heightValueTextFeet, heightValueTextInchRemainder]);

  const hasData =
    heightValueTextCm.length > 0 ||
    heightValueTextInches.length > 0 ||
    heightValueTextFeet.length > 0 ||
    heightValueTextInchRemainder.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled =
    !heightValueTextCm && !heightValueTextInches && !heightValueTextFeet && !heightValueTextInchRemainder;

  return {
    valueCm: heightValueTextCm,
    valueInches: heightValueTextInches,
    valueFeet: heightValueTextFeet,
    valueInchRemainder: heightValueTextInchRemainder,
    validationError: isValidationError,
    isDisabled,
    hasData,
    isValid,
    handleCmChange,
    handleInchesChange,
    handleFeetChange,
    handleInchRemainderChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

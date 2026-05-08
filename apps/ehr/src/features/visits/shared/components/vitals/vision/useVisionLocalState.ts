import { useCallback, useState } from 'react';
import { VitalFieldNames, VitalsVisionObservationDTO, VitalsVisionOption } from 'utils';
import { VisionLocalState } from '../types';

export function useVisionLocalState(): VisionLocalState {
  const [leftEyeSelection, setLeftEyeSelection] = useState<string>('');
  const [rightEyeSelection, setRightEyeSelection] = useState<string>('');
  const [bothEyesSelection, setBothEyesSelection] = useState<string>('');

  const [isChildTooYoungOptionSelected, setChildTooYoungOptionSelected] = useState<boolean>(false);
  const [isWithGlassesOptionSelected, setWithGlassesOptionSelected] = useState<boolean>(false);
  const [isWithoutGlassesOptionSelected, setWithoutGlassesOptionSelected] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<boolean>(false);

  const handleLeftEyeChange = useCallback((event: { target: { value: string } }): void => {
    const eventValue = event.target.value;
    setLeftEyeSelection(eventValue ?? '');
    setValidationError(false);
  }, []);

  const handleRightEyeChange = useCallback((event: { target: { value: string } }): void => {
    const eventValue = event.target.value;
    setRightEyeSelection(eventValue ?? '');
    setValidationError(false);
  }, []);

  const handleBothEyesChange = useCallback((event: { target: { value: string } }): void => {
    const eventValue = event.target.value;
    setBothEyesSelection(eventValue ?? '');
    setValidationError(false);
  }, []);

  const handleVisionOptionChange = useCallback((isChecked: boolean, visionOption: VitalsVisionOption): void => {
    setValidationError(false);
    if (visionOption === 'child_too_young') {
      setChildTooYoungOptionSelected(isChecked);
    }
    if (visionOption === 'with_glasses') {
      setWithGlassesOptionSelected(isChecked);
      setWithoutGlassesOptionSelected(false);
    }
    if (visionOption === 'without_glasses') {
      setWithoutGlassesOptionSelected(isChecked);
      setWithGlassesOptionSelected(false);
    }
  }, []);

  const clearForm = useCallback(() => {
    setLeftEyeSelection('');
    setRightEyeSelection('');
    setBothEyesSelection('');
    setChildTooYoungOptionSelected(false);
    setWithGlassesOptionSelected(false);
    setWithoutGlassesOptionSelected(false);
  }, []);

  const getDTO = useCallback((): VitalsVisionObservationDTO | null => {
    const hasBoth = leftEyeSelection.length > 0 && rightEyeSelection.length > 0;
    const hasBothEyes = bothEyesSelection.length > 0;
    if (!hasBoth && !hasBothEyes) return null;
    const extraOptions: VitalsVisionOption[] = [];
    if (isChildTooYoungOptionSelected) {
      extraOptions.push('child_too_young');
    }
    if (isWithGlassesOptionSelected) {
      extraOptions.push('with_glasses');
    }
    if (isWithoutGlassesOptionSelected) {
      extraOptions.push('without_glasses');
    }
    return {
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: leftEyeSelection,
      rightEyeVisionText: rightEyeSelection,
      bothEyesVisionText: bothEyesSelection || undefined,
      extraVisionOptions: extraOptions,
    };
  }, [
    leftEyeSelection,
    rightEyeSelection,
    bothEyesSelection,
    isChildTooYoungOptionSelected,
    isWithGlassesOptionSelected,
    isWithoutGlassesOptionSelected,
  ]);

  const hasData =
    leftEyeSelection.length > 0 ||
    rightEyeSelection.length > 0 ||
    bothEyesSelection.length > 0 ||
    isChildTooYoungOptionSelected ||
    isWithGlassesOptionSelected ||
    isWithoutGlassesOptionSelected;

  const isValid = getDTO() !== null;
  const hasBothEyesValue = bothEyesSelection.length > 0;
  const isDisabled = hasBothEyesValue ? false : !leftEyeSelection || !rightEyeSelection;

  const isLeftEyeInvalid =
    !leftEyeSelection &&
    !hasBothEyesValue &&
    (rightEyeSelection.length > 0 ||
      isChildTooYoungOptionSelected ||
      isWithGlassesOptionSelected ||
      isWithoutGlassesOptionSelected);

  const isRightEyeInvalid =
    !rightEyeSelection &&
    !hasBothEyesValue &&
    (leftEyeSelection.length > 0 ||
      isChildTooYoungOptionSelected ||
      isWithGlassesOptionSelected ||
      isWithoutGlassesOptionSelected);

  return {
    leftEyeSelection,
    rightEyeSelection,
    bothEyesSelection,
    isChildTooYoungSelected: isChildTooYoungOptionSelected,
    isWithGlassesSelected: isWithGlassesOptionSelected,
    isWithoutGlassesSelected: isWithoutGlassesOptionSelected,
    validationError,
    isLeftEyeInvalid,
    isRightEyeInvalid,
    isDisabled,
    hasData,
    isValid,
    handleLeftEyeChange,
    handleRightEyeChange,
    handleBothEyesChange,
    handleVisionOptionChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}

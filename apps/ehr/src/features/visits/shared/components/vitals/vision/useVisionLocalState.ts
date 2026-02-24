import { useCallback, useState } from 'react';
import { VitalFieldNames, VitalsVisionObservationDTO, VitalsVisionOption } from 'utils';

export interface VisionLocalState {
  leftEyeSelection: string;
  rightEyeSelection: string;
  bothEyesSelection: string;
  isChildTooYoungSelected: boolean;
  isWithGlassesSelected: boolean;
  isWithoutGlassesSelected: boolean;
  validationError: boolean;
  isLeftEyeInvalid: boolean;
  isRightEyeInvalid: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleLeftEyeChange: (event: { target: { value: string } }) => void;
  handleRightEyeChange: (event: { target: { value: string } }) => void;
  handleBothEyesChange: (event: { target: { value: string } }) => void;
  handleVisionOptionChange: (isChecked: boolean, visionOption: VitalsVisionOption) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsVisionObservationDTO | null;
}

export function useVisionLocalState(): VisionLocalState {
  const [leftEyeSelection, setLeftEyeSelection] = useState<string>('');
  const [rightEyeSelection, setRightEyeSelection] = useState<string>('');
  const [bothEyesSelection, setBothEyesSelection] = useState<string>('');

  const [isChildTooYoungOptionSelected, setChildTooYoungOptionSelected] = useState<boolean>(false);
  const [isWithGlassesOptionSelected, setWithGlassesOptionSelected] = useState<boolean>(false);
  const [isWithoutGlassesOptionSelected, setWithoutGlassesOptionSelected] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<boolean>(false);

  const handleLeftEyeChange = useCallback(
    (event: { target: { value: string } }): void => {
      const eventValue = event.target.value;
      const selectedLeftEye = eventValue ?? '';
      setLeftEyeSelection(selectedLeftEye);
      setValidationError(false);
      if (selectedLeftEye !== rightEyeSelection) {
        setBothEyesSelection('');
      }
    },
    [rightEyeSelection]
  );

  const handleRightEyeChange = useCallback(
    (event: { target: { value: string } }): void => {
      const eventValue = event.target.value;
      const selectedRightEye = eventValue ?? '';
      setRightEyeSelection(selectedRightEye);
      setValidationError(false);
      if (selectedRightEye !== leftEyeSelection) {
        setBothEyesSelection('');
      }
    },
    [leftEyeSelection]
  );

  const handleBothEyesChange = useCallback((event: { target: { value: string } }): void => {
    const eventValue = event.target.value;
    const selectedBothEyes = eventValue ?? '';
    setBothEyesSelection(selectedBothEyes);
    setLeftEyeSelection(selectedBothEyes);
    setRightEyeSelection(selectedBothEyes);
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
    if (!leftEyeSelection || !rightEyeSelection) return null;
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
      extraVisionOptions: extraOptions,
    };
  }, [
    leftEyeSelection,
    rightEyeSelection,
    isChildTooYoungOptionSelected,
    isWithGlassesOptionSelected,
    isWithoutGlassesOptionSelected,
  ]);

  const hasData =
    leftEyeSelection.length > 0 ||
    rightEyeSelection.length > 0 ||
    isChildTooYoungOptionSelected ||
    isWithGlassesOptionSelected ||
    isWithoutGlassesOptionSelected;

  const isValid = getDTO() !== null;
  const isDisabled = !leftEyeSelection || !rightEyeSelection;

  const isLeftEyeInvalid =
    !leftEyeSelection &&
    (rightEyeSelection.length > 0 ||
      isChildTooYoungOptionSelected ||
      isWithGlassesOptionSelected ||
      isWithoutGlassesOptionSelected);

  const isRightEyeInvalid =
    !rightEyeSelection &&
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

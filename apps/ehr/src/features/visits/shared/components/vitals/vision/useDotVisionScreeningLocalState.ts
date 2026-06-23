import { useCallback, useState } from 'react';
import {
  VitalFieldNames,
  VitalsDotVisionScreening,
  VitalsDotVisionScreeningDocument,
  VitalsVisionObservationDTO,
} from 'utils';

export interface DotVisionScreeningLocalState {
  horizontalFieldLeft: string;
  horizontalFieldRight: string;
  canRecognizeColors: boolean | null;
  hasMonocularVision: boolean | null;
  referredToSpecialist: boolean | null;
  receivedDocumentation: boolean | null;
  document?: VitalsDotVisionScreeningDocument;
  hasData: boolean;
  isValid: boolean;
  handleHorizontalFieldLeftChange: (value: string) => void;
  handleHorizontalFieldRightChange: (value: string) => void;
  handleCanRecognizeColorsChange: (value: boolean) => void;
  handleMonocularVisionChange: (value: boolean) => void;
  handleReferredChange: (value: boolean) => void;
  handleReceivedDocumentationChange: (value: boolean) => void;
  setDocument: (document?: VitalsDotVisionScreeningDocument) => void;
  clearForm: () => void;
  getDTO: () => VitalsVisionObservationDTO | null;
}

const parseDegrees = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export function useDotVisionScreeningLocalState(): DotVisionScreeningLocalState {
  const [horizontalFieldLeft, setHorizontalFieldLeft] = useState<string>('');
  const [horizontalFieldRight, setHorizontalFieldRight] = useState<string>('');
  const [canRecognizeColors, setCanRecognizeColors] = useState<boolean | null>(null);
  const [hasMonocularVision, setHasMonocularVision] = useState<boolean | null>(null);
  const [referredToSpecialist, setReferredToSpecialist] = useState<boolean | null>(null);
  const [receivedDocumentation, setReceivedDocumentation] = useState<boolean | null>(null);
  const [document, setDocumentState] = useState<VitalsDotVisionScreeningDocument | undefined>(undefined);

  const handleReceivedDocumentationChange = useCallback((value: boolean): void => {
    setReceivedDocumentation(value);
    // Clear any attached document when the answer is switched to "No".
    if (!value) {
      setDocumentState(undefined);
    }
  }, []);

  const clearForm = useCallback(() => {
    setHorizontalFieldLeft('');
    setHorizontalFieldRight('');
    setCanRecognizeColors(null);
    setHasMonocularVision(null);
    setReferredToSpecialist(null);
    setReceivedDocumentation(null);
    setDocumentState(undefined);
  }, []);

  const buildDotData = useCallback((): VitalsDotVisionScreening => {
    return {
      horizontalFieldLeftDegrees: parseDegrees(horizontalFieldLeft),
      horizontalFieldRightDegrees: parseDegrees(horizontalFieldRight),
      canRecognizeColors: canRecognizeColors ?? undefined,
      hasMonocularVision: hasMonocularVision ?? undefined,
      referredToSpecialist: referredToSpecialist ?? undefined,
      receivedDocumentation: receivedDocumentation ?? undefined,
      document: receivedDocumentation ? document : undefined,
    };
  }, [
    horizontalFieldLeft,
    horizontalFieldRight,
    canRecognizeColors,
    hasMonocularVision,
    referredToSpecialist,
    receivedDocumentation,
    document,
  ]);

  const hasData =
    horizontalFieldLeft.trim() !== '' ||
    horizontalFieldRight.trim() !== '' ||
    canRecognizeColors !== null ||
    hasMonocularVision !== null ||
    referredToSpecialist !== null ||
    receivedDocumentation !== null;

  const getDTO = useCallback((): VitalsVisionObservationDTO | null => {
    const dot = buildDotData();
    const hasAnyValue = Object.values(dot).some((value) => value !== undefined);
    if (!hasAnyValue) return null;
    return {
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: '',
      rightEyeVisionText: '',
      dotVisionScreening: dot,
    };
  }, [buildDotData]);

  return {
    horizontalFieldLeft,
    horizontalFieldRight,
    canRecognizeColors,
    hasMonocularVision,
    referredToSpecialist,
    receivedDocumentation,
    document,
    hasData,
    isValid: hasData,
    handleHorizontalFieldLeftChange: setHorizontalFieldLeft,
    handleHorizontalFieldRightChange: setHorizontalFieldRight,
    handleCanRecognizeColorsChange: setCanRecognizeColors,
    handleMonocularVisionChange: setHasMonocularVision,
    handleReferredChange: setReferredToSpecialist,
    handleReceivedDocumentationChange,
    setDocument: setDocumentState,
    clearForm,
    getDTO,
  };
}

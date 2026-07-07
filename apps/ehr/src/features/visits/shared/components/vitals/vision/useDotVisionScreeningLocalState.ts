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
  horizontalFieldLeftInvalid: boolean;
  horizontalFieldRightInvalid: boolean;
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

// A horizontal field of vision is an angle in degrees; anything outside this range is a data-entry
// error (negative angles, absurdly large numbers, or non-numeric input such as a lone "+").
export const DOT_VISION_DEGREES_MIN = 0;
export const DOT_VISION_DEGREES_MAX = 180;

const isDegreesValueValid = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= DOT_VISION_DEGREES_MIN && num <= DOT_VISION_DEGREES_MAX;
};

const parseDegrees = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < DOT_VISION_DEGREES_MIN || num > DOT_VISION_DEGREES_MAX) return undefined;
  return num;
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

  const horizontalFieldLeftInvalid = !isDegreesValueValid(horizontalFieldLeft);
  const horizontalFieldRightInvalid = !isDegreesValueValid(horizontalFieldRight);

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
    horizontalFieldLeftInvalid,
    horizontalFieldRightInvalid,
    // Reflect whether a saveable DTO actually exists, not merely that a field was touched: a
    // non-numeric or out-of-range degrees entry leaves hasData true but produces no DTO, so the
    // button must stay disabled rather than become a silent no-op (or save a bogus angle) on click.
    isValid: getDTO() !== null && !horizontalFieldLeftInvalid && !horizontalFieldRightInvalid,
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

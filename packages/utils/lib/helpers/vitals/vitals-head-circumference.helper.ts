import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from './vitals-height.helper';

// Head circumference is a length in cm, entered and shown like height (cm ≈ inches) minus the feet split.
export const formatHeadCircumferenceObservationValue = (cm: number): string => {
  const measurement = HeightMeasurement.fromCm(cm);
  return `${measurement.getCm(HEIGHT_CM_DISPLAY_PRECISION)} cm ≈ ${measurement.getInches()} in`;
};

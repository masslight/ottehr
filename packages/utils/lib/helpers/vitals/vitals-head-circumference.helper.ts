import { HeightMeasurement } from './vitals-height.helper';

export const formatHeadCircumferenceObservationValue = (cm: number): string =>
  HeightMeasurement.fromCm(cm).getCmInchesLabel();

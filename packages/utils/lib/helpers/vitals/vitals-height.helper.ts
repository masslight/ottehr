import { roundNumberToDecimalPlaces } from '../../utils';

export const cmToInches = (heightCm: number): number => roundNumberToDecimalPlaces(0.393701 * heightCm, 1);

export const inchesToCm = (heightInches: number): number => roundNumberToDecimalPlaces(heightInches / 0.393701, 1);

export const roundToNearestHalf = (value: number): number => Math.round(value * 2) / 2;

export type HeightFeetInchesDisplay = {
  heightCm: number;
  totalInches: number;
  feet: number;
  inchRemainder: number;
};

export const heightCmToFeetInches = (heightCm: number): HeightFeetInchesDisplay => {
  const totalInches = cmToInches(heightCm);
  const half = roundToNearestHalf(totalInches);

  return {
    heightCm,
    totalInches,
    feet: Math.floor(half / 12),
    inchRemainder: half % 12,
  };
};

export const formatHeightFeetInchesLabel = (feet: number, inchRemainder: number): string => `${feet}'${inchRemainder}"`;

export const formatHeightObservationValue = (heightCm: number): string => {
  const { totalInches, feet, inchRemainder } = heightCmToFeetInches(heightCm);
  return `${heightCm} cm = ${totalInches} in = ${formatHeightFeetInchesLabel(feet, inchRemainder)}`;
};

export const feetInchesToCm = (feet: number, inchRemainder: number): number => inchesToCm(feet * 12 + inchRemainder);

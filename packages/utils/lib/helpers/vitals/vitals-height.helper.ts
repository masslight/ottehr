import { roundNumberToDecimalPlaces } from '../../utils';

export const cmToInches = (heightCm: number): number => roundNumberToDecimalPlaces(0.393701 * heightCm, 1);

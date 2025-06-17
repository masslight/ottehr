import { roundNumberToDecimalPlaces } from '../../utils';

export const heightInCmToInch = (heightCm: number): number => roundNumberToDecimalPlaces(0.3937 * heightCm, 1);

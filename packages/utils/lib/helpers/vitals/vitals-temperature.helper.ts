import { roundNumberToDecimalPlaces } from '../../utils';

export const roundTemperatureValue = (temperature: number): number => roundNumberToDecimalPlaces(temperature, 1);

export const roundTemperatureForSave = (temperature: number): number => roundNumberToDecimalPlaces(temperature, 3);

export const celsiusToFahrenheit = (tempInCelsius: number): number =>
  roundTemperatureForSave((9 / 5) * tempInCelsius + 32);

export const fahrenheitToCelsius = (tempInFahrenheit: number): number =>
  roundTemperatureForSave((5 / 9) * (tempInFahrenheit - 32));

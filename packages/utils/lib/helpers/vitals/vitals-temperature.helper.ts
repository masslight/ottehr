import { roundNumberToDecimalPlaces } from '../../utils';

export const roundTemperatureValue = (temperature: number): number => roundNumberToDecimalPlaces(temperature, 1);

export const celsiusToFahrenheit = (tempInCelsius: number): number =>
  roundTemperatureValue((9 / 5) * tempInCelsius + 32);

export const fahrenheitToCelsius = (tempInFahrenheit: number): number =>
  roundTemperatureValue((5 / 9) * (tempInFahrenheit - 32));

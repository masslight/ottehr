import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToTemperatureNumber = (text: string): number | undefined => {
  const tempVal = textToNumericValue(text);
  if (!tempVal) return;
  return roundTemperatureValue(tempVal);
};

export const celsiusToFahrenheit = (tempInCelsius: number): number =>
  roundTemperatureValue((9 / 5) * tempInCelsius + 32);

const roundTemperatureValue = (temperature: number): number => roundNumberToDecimalPlaces(temperature, 1);

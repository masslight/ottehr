export function convertToBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;

  const map: { [key: string]: boolean } = {
    yes: true,
    no: false,
    true: true,
    false: false,
    '1': true,
    '0': false,
    on: true,
    off: false,
    y: true,
    n: false,
  };

  return map[value.toLowerCase()];
}

export const convertBooleanToString = (value: boolean | undefined): string =>
  value === true ? 'Yes' : value === false ? 'No' : '';

export const isNumericValue = (value: string): boolean => {
  if (isNaN(+value) || isNaN(parseFloat(value))) {
    return false;
  }
  return true;
};

export const textToNumericValue = (text: string): number | undefined => {
  if (!isNumericValue(text)) return;
  return +text;
};

export const roundNumberToDecimalPlaces = (value: number, decimalPlaces = 1): number => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
};

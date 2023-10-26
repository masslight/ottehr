export const regex = {
  alphanumeric: /^[a-zA-Z0-9]+$/,
  cardExpiration: /^\d{2} \/ \d{2}$/,
  email: /^\S+@\S+\.\S+$/,
  phone: /^\d{10}$/,
  state: /^[A-Za-z]{2}$/,
  yupDate: /^\d{2}\/\d{2}\/\d{4}$/,
  zip: /^\d{5}$/,
};

// modified from https://stackoverflow.com/a/50376498
export function isNumber(value: string): boolean {
  if (value.includes(' ')) {
    return false;
  }
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}

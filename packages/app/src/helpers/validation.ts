export const emailRegex = /^\S+@\S+\.\S+$/;
export const stateRegex = /^[A-Za-z]{2}$/;
export const zipRegex = /^\d{5}$/;
export const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
export const cardExpirationRegex = /^\d{2} \/ \d{2}$/;

// modified from https://stackoverflow.com/a/50376498
export function isNumber(value: string): boolean {
  if (value.includes(' ')) {
    return false;
  }
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}

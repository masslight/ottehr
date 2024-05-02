export const MINIMUM_AGE = 0;
export const MAXIMUM_AGE = 26;
export const MAXIMUM_CHARACTER_LIMIT = 160;

// Phone number regex
// ^(\+1)? match an optional +1 at the beginning of the string
// \d{10}$ match exactly 10 digits at the end of the string
export const phoneRegex = /^(\+1)?\d{10}$/;

export const emailRegex = /^\S+@\S+\.\S+$/;
export const zipRegex = /^\d{5}$/;
export const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
export const emojiRegex = /^(?:(?!\p{Extended_Pictographic}).)*$/u;
export const alphanumericRegex = /^[a-zA-Z0-9]+/;
export const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const yupSimpleDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
export const yupFHIRDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

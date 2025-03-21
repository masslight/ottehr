import { ZambdaInput } from './types';

export function assertDefined<T>(value: T, name: string): NonNullable<T> {
  if (value == null) {
    throw `"${name}" is undefined`;
  }
  return value;
}

export const validateString = (value: any, propertyName: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`"${propertyName}" property must be a string`);
  }
  return value;
};

export function validateJsonBody(input: ZambdaInput): any {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  try {
    return JSON.parse(input.body);
  } catch (_error) {
    throw new Error('Invalid JSON in request body');
  }
}

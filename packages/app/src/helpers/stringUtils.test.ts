import { expect, test, describe } from 'vitest';
import { createProviderName } from './stringUtils';

describe('stringUtils tests', () => {
  test('createProviderName with valid provider object generates correct full name', () => {
    expect(createProviderName({ firstName: 'Olivia', lastName: 'Smith', title: 'Dr' }, true)).toBe('Dr. Olivia Smith');
  });

  test('createProviderName with missing first name, generates correct full name', () => {
    expect(createProviderName({ lastName: 'Smith', title: 'Dr' }, true)).toBe('Dr. Smith');
  });

  test('createProviderName with missing last name, generates correct full name', () => {
    expect(createProviderName({ firstName: 'Olivia', title: 'Dr' }, true)).toBe('Dr. Olivia');
  });

  test('createProviderName with valid provider object generates correct name', () => {
    expect(createProviderName({ firstName: 'Olivia', lastName: 'Smith', title: 'Dr' })).toBe('Dr. Smith');
  });

  test('createProviderName with missing first name, generates correct name', () => {
    expect(createProviderName({ lastName: 'Smith', title: 'Dr' })).toBe('Dr. Smith');
  });

  test('createProviderName with missing last name, generates correct name', () => {
    expect(createProviderName({ firstName: 'Olivia', title: 'Dr' })).toBe('');
  });

  test('createProviderName with missing first and last name, generates correct name', () => {
    expect(createProviderName({ firstName: 'Olivia', title: 'Dr' })).toBe('');
  });
});

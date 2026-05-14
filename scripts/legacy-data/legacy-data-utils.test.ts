import { describe, expect, it } from 'vitest';
import { buildPatientFolder, type CsvRow, parseFolderName } from './legacy-data-utils.js';

function makeRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    lastName: 'Smith',
    firstName: 'Jane',
    dob: '1990-05-15',
    patientId: '1234567',
    path: '',
    documentType: '',
    description: '',
    ...overrides,
  };
}

describe('parseFolderName (v1 data)', () => {
  it('parses a standard 4-part folder name', () => {
    expect(parseFolderName('1234567_Smith_Jane_05-11-2022')).toEqual({
      z3Prefix: 'smith_jane_05-11-2022/1234567',
      patientId: '1234567',
    });
  });

  it('returns null when fewer than 4 underscore-separated parts', () => {
    expect(parseFolderName('1234567_Smith_Jane')).toBeNull();
    expect(parseFolderName('Smith')).toBeNull();
  });

  it('lowercases last and first name', () => {
    expect(parseFolderName('999_DOE_JOHN_12-31-1985')).toEqual({
      z3Prefix: 'doe_john_12-31-1985/999',
      patientId: '999',
    });
  });

  it('reassembles a DOB that was stored with underscores instead of hyphens', () => {
    // folder: 1234567_Smith_Jane_05_11_2022 → parts[3..] = ['05','11','2022'] → joined as '05-11-2022'
    expect(parseFolderName('1234567_Smith_Jane_05_11_2022')).toEqual({
      z3Prefix: 'smith_jane_05-11-2022/1234567',
      patientId: '1234567',
    });
  });
});

describe('buildPatientFolder (v2 data)', () => {
  it('formats a basic row correctly', () => {
    expect(buildPatientFolder(makeRow())).toBe('smith_jane_05-15-1990/1234567');
  });

  it('lowercases last and first name', () => {
    expect(buildPatientFolder(makeRow({ lastName: 'SMITH', firstName: 'JANE' }))).toBe('smith_jane_05-15-1990/1234567');
  });

  it('converts dob from YYYY-MM-DD to MM-DD-YYYY', () => {
    expect(buildPatientFolder(makeRow({ dob: '2000-01-31' }))).toBe('smith_jane_01-31-2000/1234567');
  });

  it('replaces spaces in names with underscores', () => {
    expect(buildPatientFolder(makeRow({ lastName: 'Van Dijk', firstName: 'Mary Jane' }))).toBe(
      'van_dijk_mary_jane_05-15-1990/1234567'
    );
  });

  it('strips special characters from names', () => {
    expect(buildPatientFolder(makeRow({ lastName: "O'Brien", firstName: 'Ján' }))).toBe('obrien_jn_05-15-1990/1234567');
  });

  it('preserves hyphens in names', () => {
    expect(buildPatientFolder(makeRow({ firstName: 'Jean-Luc' }))).toBe('smith_jean-luc_05-15-1990/1234567');
  });

  it('sanitizes the patientId', () => {
    expect(buildPatientFolder(makeRow({ patientId: '123 456' }))).toBe('smith_jane_05-15-1990/123_456');
  });

  it('passes through a dob already in MM-DD-YYYY format', () => {
    expect(buildPatientFolder(makeRow({ dob: '05-15-1990' }))).toBe('smith_jane_05-15-1990/1234567');
  });

  it('throws when dob uses an unexpected format', () => {
    expect(() => buildPatientFolder(makeRow({ dob: '05/15/1990' }))).toThrow('Unexpected dob format');
  });
});

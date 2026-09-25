import { describe, expect, it } from 'vitest';
import {
  dateParts,
  formatAddressLine,
  formatCityStateZip,
  formatDiagnosisCode,
  formatDiagnosisPointers,
  formatFirstLastName,
  formatLastFirstName,
  formatShortDate,
  formatUnits,
  moneyParts,
  phoneParts,
  toPrintable,
  zipDigits,
} from './format';

describe('CMS-1500 print formatting', () => {
  it('upper-cases to printable ASCII', () => {
    expect(toPrintable('  José  Núñez\tO’Brien ')).toBe("JOSE NUNEZ O'BRIEN");
    expect(toPrintable('Smith–Jones 北京')).toBe('SMITH-JONES');
    expect(toPrintable(undefined)).toBe('');
  });

  it('formats patient and insured names as LAST, FIRST, MI with the suffix after the last name', () => {
    expect(formatLastFirstName({ last: 'Doe', first: 'Jane', middle: 'Alice' })).toBe('DOE, JANE, A');
    expect(formatLastFirstName({ last: 'Smith', first: 'John', suffix: 'Jr.' })).toBe('SMITH JR, JOHN');
    expect(formatLastFirstName({ last: 'St. James', first: 'Mary-Kate', middle: '' })).toBe('ST JAMES, MARY-KATE');
    expect(formatLastFirstName(undefined)).toBe('');
  });

  it('formats provider names as FIRST MI LAST followed by credentials', () => {
    expect(formatFirstLastName({ first: 'Gregory', middle: 'Hugh', last: 'House' }, 'M.D.')).toBe('GREGORY H HOUSE MD');
    expect(formatFirstLastName({ first: 'Ann', last: 'Lee' })).toBe('ANN LEE');
  });

  it('drops punctuation from addresses and spells out ZIP+4 in address blocks', () => {
    expect(formatAddressLine('123 N. Main Street', 'Apt #4B')).toBe('123 N MAIN STREET APT 4B');
    expect(formatCityStateZip({ city: 'Boston', state: 'MA', postalCode: '02110-1234' })).toBe('BOSTON MA 02110-1234');
    expect(formatCityStateZip({ city: 'Boston', state: 'MA', postalCode: '02110' })).toBe('BOSTON MA 02110');
    expect(zipDigits('02110-1234')).toBe('021101234');
  });

  it('reads calendar dates without time zone shifts', () => {
    expect(dateParts('2026-01-05')).toEqual({ mm: '01', dd: '05', yy: '26', yyyy: '2026' });
    expect(dateParts('2026-12-31T23:30:00-05:00')).toEqual({ mm: '12', dd: '31', yy: '26', yyyy: '2026' });
    expect(dateParts('01/05/2026')).toBeUndefined();
    expect(formatShortDate('2026-09-05')).toBe('09 05 26');
    expect(formatShortDate(undefined)).toBe('');
  });

  it('splits amounts into dollars and cents without symbols or separators', () => {
    expect(moneyParts(150)).toEqual({ dollars: '150', cents: '00' });
    expect(moneyParts(1234.5)).toEqual({ dollars: '1234', cents: '50' });
    expect(moneyParts(0.1 + 0.2)).toEqual({ dollars: '0', cents: '30' });
    expect(moneyParts(-12.75)).toEqual({ dollars: '-12', cents: '75' });
    expect(moneyParts(undefined)).toBeUndefined();
    expect(moneyParts(Number.NaN)).toBeUndefined();
  });

  it('splits phone numbers into the area code and the rest', () => {
    expect(phoneParts('(617) 555-1234')).toEqual({ areaCode: '617', number: '5551234' });
    expect(phoneParts('+1 617 555 1234')).toEqual({ areaCode: '617', number: '5551234' });
    expect(phoneParts('555-1234')).toEqual({ areaCode: '', number: '5551234' });
    expect(phoneParts('')).toBeUndefined();
  });

  it('prints diagnosis codes without the implied decimal point', () => {
    expect(formatDiagnosisCode('s82.101a')).toBe('S82101A');
    expect(formatDiagnosisCode('J06.9')).toBe('J069');
  });

  it('prints up to four distinct diagnosis pointer letters', () => {
    expect(formatDiagnosisPointers([1, 2, 2, 13, 0, 4, 5, 6])).toBe('ABDE');
    expect(formatDiagnosisPointers([12])).toBe('L');
    expect(formatDiagnosisPointers(undefined)).toBe('');
  });

  it('prints units left justified without leading zeros', () => {
    expect(formatUnits(1)).toBe('1');
    expect(formatUnits(1.5)).toBe('1.5');
    expect(formatUnits(0.25)).toBe('.25');
    expect(formatUnits(undefined)).toBe('');
  });
});

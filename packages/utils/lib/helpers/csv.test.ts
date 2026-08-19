import { describe, expect, it } from 'vitest';
import { escapeCsvField, toCsv, toCsvRow } from './csv';

describe('escapeCsvField', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCsvField('Acme Health')).toBe('Acme Health');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvField('Doe, Jane')).toBe('"Doe, Jane"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('the "primary" payer')).toBe('"the ""primary"" payer"');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvField('line one\r\nline two')).toBe('"line one\r\nline two"');
  });
});

describe('toCsvRow', () => {
  it('joins fields with commas, escaping each', () => {
    expect(toCsvRow(['a', 'b,c', ''])).toBe('a,"b,c",');
  });
});

describe('toCsv', () => {
  it('writes the header row followed by one line per row', () => {
    const csv = toCsv(
      ['Patient Name', 'Billed'],
      [
        ['Doe, Jane', '100.00'],
        ['Smith', '0.00'],
      ]
    );
    expect(csv).toBe('Patient Name,Billed\n"Doe, Jane",100.00\nSmith,0.00');
  });

  it('writes just the headers when there are no rows', () => {
    expect(toCsv(['Patient Name'], [])).toBe('Patient Name');
  });
});

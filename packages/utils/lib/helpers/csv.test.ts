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

  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'prefixes %j, which a spreadsheet would evaluate',
    (value) => {
      expect(escapeCsvField(value)).toBe(/[",\n\r]/.test(value) ? `"'${value}"` : `'${value}`);
    }
  );

  it('prefixes a formula that also needs RFC-4180 quoting', () => {
    expect(escapeCsvField('=HYPERLINK("a","b")')).toBe('"\'=HYPERLINK(""a"",""b"")"');
  });

  it.each(['-50.00', '+12', '1,234.56', '0.00', '-1,234.56'])('leaves the amount %s unprefixed', (value) => {
    expect(escapeCsvField(value)).toBe(/[",\n\r]/.test(value) ? `"${value}"` : value);
  });

  it('prefixes a value that only looks numeric', () => {
    expect(escapeCsvField('-1+cmd')).toBe("'-1+cmd");
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

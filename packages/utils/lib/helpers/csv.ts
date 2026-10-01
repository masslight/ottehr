const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NUMERIC = /^[-+]?[\d,]*\.?\d+$/;

// RFC 4180 quoting: a field carrying a comma, quote, or newline is wrapped in quotes and its own
// quotes doubled.
export function escapeCsvField(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) && !NUMERIC.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}

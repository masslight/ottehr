// RFC 4180 quoting: a field carrying a comma, quote, or newline is wrapped in quotes and its own
// quotes doubled.
export function escapeCsvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}

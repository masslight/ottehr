// Named value formatters for KPI cards + table cells. The generated code names a format; the value
// is already computed, so these only add units/separators — no expression evaluation.
// The format NAMES come from the runtime-scope catalog (the same list the prompt shows the model);
// type-only deep import ⇒ nothing is added to the iframe bundle.
import type { ValueFormat } from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';

export type { ValueFormat };

export function cellText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map(cellText)
      .filter((text) => text !== '')
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, cellText(item)] as const)
      .filter(([, text]) => text !== '')
      .map(([key, text]) => `${key}: ${text}`)
      .join(', ');
  }
  return String(value);
}

export function formatValue(value: unknown, format?: ValueFormat): string {
  if (value == null) return '';
  const cleaned = typeof value === 'string' ? value.trim().replace(/^"(.*)"$/, '$1') : value;
  const n = typeof cleaned === 'number' ? cleaned : Number(cleaned);
  const isNum = Number.isFinite(n);
  switch (format) {
    case 'integer':
      return isNum ? Math.round(n).toLocaleString() : String(value);
    case 'number':
      return isNum ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);
    case 'percent':
      return isNum ? `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : String(value);
    case 'currency':
      return isNum
        ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value);
    default:
      return String(value);
  }
}

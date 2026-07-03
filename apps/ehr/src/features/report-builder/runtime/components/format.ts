// Named value formatters for KPI cards + table cells. The generated code names a format; the value
// is already computed, so these only add units/separators — no expression evaluation.
// The format NAMES come from the runtime-scope catalog (the same list the prompt shows the model);
// type-only deep import ⇒ nothing is added to the iframe bundle.
import type { ValueFormat } from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';

export type { ValueFormat };

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

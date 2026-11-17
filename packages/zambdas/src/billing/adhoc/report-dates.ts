import { DateTime } from 'luxon';
import { z } from 'zod';

export const REPORT_ZONE = 'America/New_York';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

export function toReportDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (YMD.test(value)) return value;

  if (!HAS_OFFSET.test(value)) {
    const local = DateTime.fromISO(value);
    return local.isValid ? local.toISODate() : null;
  }

  const instant = DateTime.fromISO(value, { setZone: true });
  return instant.isValid ? instant.setZone(REPORT_ZONE).toISODate() : null;
}

const describesDay = (schema: z.ZodTypeAny): boolean => schema.description?.includes('yyyy-MM-dd') ?? false;

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; isDay: boolean } {
  let inner = schema;
  let isDay = describesDay(schema);
  while (inner instanceof z.ZodNullable || inner instanceof z.ZodOptional) {
    inner = inner.unwrap();
    isDay ||= describesDay(inner);
  }
  return { inner, isDay };
}

export interface DayFields {
  fields: string[];
  nested: Record<string, string[]>;
}

export function dayFieldsOf(row: z.ZodObject<z.ZodRawShape>): DayFields {
  const fields: string[] = [];
  const nested: Record<string, string[]> = {};

  for (const [name, field] of Object.entries(row.shape)) {
    const { inner, isDay } = unwrap(field);

    if (isDay && inner instanceof z.ZodString) fields.push(name);

    if (inner instanceof z.ZodArray) {
      const element = unwrap(inner.element).inner;

      if (element instanceof z.ZodObject) {
        const days = Object.entries(element.shape as z.ZodRawShape)
          .filter(([, elementField]) => {
            const unwrapped = unwrap(elementField);
            return unwrapped.isDay && unwrapped.inner instanceof z.ZodString;
          })
          .map(([elementName]) => elementName);

        if (days.length > 0) nested[name] = days;
      }
    }
  }

  return { fields, nested };
}

export function withReportDays<T extends object>(row: T, { fields, nested }: DayFields): T {
  const out = { ...row } as Record<string, unknown>;

  for (const name of fields) {
    if (typeof out[name] === 'string') out[name] = toReportDay(out[name] as string);
  }

  for (const [name, days] of Object.entries(nested)) {
    const items = out[name];
    if (!Array.isArray(items)) continue;

    out[name] = items.map((item: Record<string, unknown>) => {
      const converted = { ...item };
      for (const day of days) {
        if (typeof converted[day] === 'string') converted[day] = toReportDay(converted[day] as string);
      }

      return converted;
    });
  }

  return out as T;
}

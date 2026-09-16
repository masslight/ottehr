import type { ProcedureFactsInput } from './model.types';

export type StructuredValue = string | number | boolean | undefined;
export type StructuredRow = Record<string, StructuredValue>;

export interface StructuredFacts {
  [key: string]: StructuredValue | StructuredRow[];
}

interface CodingFieldBase {
  details?: boolean;
  key: string;
  label: string;
  helperText?: string;
  visible?: (facts: StructuredFacts) => boolean;
}

export interface SelectCodingField extends CodingFieldBase {
  kind: 'select';
  options: readonly string[];
  defaultValue?: string;
}

export interface NumberCodingField extends CodingFieldBase {
  kind: 'number';
  defaultValue?: number;
  min?: number;
  step?: number;
}

export interface CheckboxCodingField extends CodingFieldBase {
  kind: 'checkbox';
  defaultValue?: boolean;
}

export interface TextCodingField extends CodingFieldBase {
  kind: 'text' | 'time';
  defaultValue?: string;
}

export type ScalarCodingField = SelectCodingField | NumberCodingField | CheckboxCodingField | TextCodingField;

export interface RowsCodingField extends CodingFieldBase {
  kind: 'rows';
  /** Singular name of one row: the group header says "Wounds", a row says "Wound 1". */
  rowLabel: string;
  fields: readonly ScalarCodingField[];
  defaultValue?: never;
}

/** Form metadata only. The kind determines the allowed defaults and children; billing stays in TS functions. */
export type CodingField = ScalarCodingField | RowsCodingField;

/** Read only explicit answers. Never inspect procedureDetails, display names or CPT descriptions. */
export function getStructuredFieldsData(input: ProcedureFactsInput, fields: readonly CodingField[]): StructuredFacts {
  const stored = input.structuredFacts ?? {};
  const facts: StructuredFacts = { ...stored };

  for (const field of fields) {
    const value = stored[field.key];

    facts[field.key] =
      field.kind === 'rows' && Array.isArray(value)
        ? value.map((row) => getStructuredFieldsData({ structuredFacts: row }, field.fields ?? []) as StructuredRow)
        : value === undefined || value === ''
        ? field.defaultValue
        : value;
  }

  // Conditions use the complete set of answers/defaults. Hidden answers are inapplicable,
  // including values saved before the controlling answer changed.
  for (const field of fields) {
    if (field.visible && !field.visible(facts)) facts[field.key] = undefined;
  }

  return facts;
}

export function invalidStructuredFields(fields: readonly CodingField[], facts: StructuredFacts): string[] {
  return fields.flatMap((field) => {
    const value = facts[field.key];

    if (value === undefined || (field.visible && !field.visible(facts))) return [];

    if (field.kind === 'rows')
      return Array.isArray(value)
        ? value.flatMap((row, i) =>
            invalidStructuredFields(field.fields ?? [], row).map((label) => `${field.label} ${i + 1}: ${label}`)
          )
        : [field.label];

    if (field.kind === 'checkbox') return typeof value === 'boolean' ? [] : [field.label];

    if (field.kind === 'number')
      return typeof value === 'number' && Number.isFinite(value) && value >= (field.min ?? 0) ? [] : [field.label];

    if (field.kind === 'select')
      return typeof value === 'string' && field.options?.includes(value) ? [] : [field.label];

    return typeof value === 'string' ? [] : [field.label];
  });
}

export function readNumber(facts: StructuredFacts | StructuredRow, key: string): number | undefined {
  const value = facts[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readRows(facts: StructuredFacts, key: string): StructuredRow[] {
  const rows = facts[key];
  return Array.isArray(rows) ? rows : [];
}

/** Shape validation protects API/FHIR boundaries; missing answers are intentionally saveable. */
export function isStructuredFacts(value: unknown): value is StructuredFacts {
  const scalar = (v: unknown): boolean =>
    v === undefined || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));

  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (v) =>
        scalar(v) ||
        (Array.isArray(v) &&
          v.every(
            (row) => row !== null && typeof row === 'object' && !Array.isArray(row) && Object.values(row).every(scalar)
          ))
    )
  );
}

export function parseStructuredFacts(value?: string, onError?: (error: unknown) => void): StructuredFacts | undefined {
  if (value === undefined) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);

    if (!isStructuredFacts(parsed)) throw new Error('Invalid saved procedure structured fields');

    return parsed;
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}

export function selectedSide(input: ProcedureFactsInput): 'left' | 'right' | 'both' | undefined {
  const sides: Partial<Record<string, 'left' | 'right' | 'both'>> = {
    Left: 'left',
    Right: 'right',
    Bilateral: 'both',
    Both: 'both',
    left: 'left',
    right: 'right',
    both: 'both',
  };

  return sides[input.bodySide ?? ''];
}

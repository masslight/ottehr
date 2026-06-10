import { AdHocRow, DatasetSchema, FieldSchema, FieldType } from './types';

// Categorical columns with more distinct values than this are treated as free text (no value
// domain sent to the LLM) — keeps the schema small and avoids shipping a long list of, say, every
// patient name as a "value domain".
const MAX_DISTINCT_VALUES = 50;

// Multi-valued CODE columns (ICD-10 / CPT arrays) get a much higher cap: the distinct set is
// bounded and clinically meaningful, and showing the model the codes ACTUALLY present lets it
// filter against real values instead of recalling a code list from memory (which is fragile —
// see the otitis prefix fix). A few hundred short codes is cheap.
const MAX_DISTINCT_CODE_VALUES = 500;

export interface FieldDef {
  name: string;
  type: FieldType;
  description: string;
}

/**
 * Build the schema descriptor from the fetched rows: per field, attach the value domain (distinct
 * values for low-cardinality strings) or min/max (numbers/dates). This is column metadata only —
 * no individual rows leave the client.
 */
export function buildSchema(
  rows: AdHocRow[],
  meta: { datasetId: string; label: string; description: string },
  fieldDefs: FieldDef[]
): DatasetSchema {
  const fields: FieldSchema[] = fieldDefs.map((def) => {
    const field: FieldSchema = { name: def.name, type: def.type, description: def.description };
    const present = rows.map((r) => r[def.name]).filter((v) => v !== null && v !== undefined && v !== '');

    if (def.type === 'string') {
      const distinct = [...new Set(present.map((v) => String(v)))];
      if (distinct.length > 0 && distinct.length <= MAX_DISTINCT_VALUES) {
        field.values = distinct.sort();
      }
    } else if (def.type === 'string[]') {
      // Multi-valued column (e.g. a visit's ICD-10 codes): the value domain is the distinct set
      // across all rows' array elements.
      const flattened = present.flatMap((v) => (Array.isArray(v) ? v.map((x) => String(x)) : []));
      const distinct = [...new Set(flattened)];
      if (distinct.length > 0 && distinct.length <= MAX_DISTINCT_CODE_VALUES) {
        field.values = distinct.sort();
      }
    } else if (def.type === 'number') {
      const nums = present.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
      if (nums.length) {
        field.min = Math.min(...nums);
        field.max = Math.max(...nums);
      }
    } else if (def.type === 'date') {
      const dates = present.map((v) => String(v)).sort();
      if (dates.length) {
        field.min = dates[0];
        field.max = dates[dates.length - 1];
      }
    }
    return field;
  });

  return {
    datasetId: meta.datasetId,
    label: meta.label,
    description: meta.description,
    rowCount: rows.length,
    fields,
  };
}

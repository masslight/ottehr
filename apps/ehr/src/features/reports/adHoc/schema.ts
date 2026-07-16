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

// PRIVACY INVARIANT: identifier / contact / geographic columns must NEVER have their value domain
// sent to the LLM, regardless of cardinality — on a narrow date range those distinct sets ARE the
// patients' names, phones, emails, and sub-state geography (all HIPAA identifiers). Only the
// column's existence and type are described; the model builds links from the FIELD, never from
// literal id values. A field is withheld when it is flagged `sensitive`, ends in "Id" (opaque
// resource keys / member ids — useless as a domain and a re-identification key anyway), or its
// name matches an identifier pattern. Operational categoricals (visitType, source, provider,
// region, subscriberRelationship, state) are deliberately NOT matched — their domains are useful
// and non-identifying (state is not a sub-state geography under Safe Harbor).
const IDENTIFIER_NAME =
  /name|phone|email|city|zip|postal|address|street|\bmember\b|memberid|\bssn\b|\bmrn\b|guarantor/i;
// Date-of-birth columns: even the min/max range exposes two patients' exact birth dates (an
// identifier), so DOB-like date fields get no observed range either — `age` carries the useful signal.
const DOB_NAME = /dob|dateofbirth|birthdate/i;

function withholdsValueDomain(def: FieldDef): boolean {
  // `Id$` is the camelCase boundary (patientId, appointmentId, memberId) — case-sensitive so it
  // does NOT match words that merely end in "id" like "insurancePaid". The `name` match is
  // deliberately broad (safe-by-default: a future person-name field is auto-protected); it also
  // withholds the "resultNames" test-name domain, an acceptable, non-identifying loss of convenience.
  return def.sensitive === true || /Id$/.test(def.name) || IDENTIFIER_NAME.test(def.name);
}

export interface FieldDef {
  name: string;
  type: FieldType;
  description: string;
  /** Force this column's value domain to be withheld from the schema sent to the LLM, for a PII
   *  field whose name doesn't match the identifier heuristic (see withholdsValueDomain). */
  sensitive?: boolean;
}

/**
 * Build the schema descriptor from the fetched rows: per field, attach the value domain (distinct
 * values for low-cardinality strings) or min/max (numbers/dates). This is column metadata only —
 * no individual rows leave the client.
 */
export function buildSchema(
  rows: AdHocRow[],
  meta: {
    datasetId: string;
    label: string;
    description: string;
    availableLayers?: { id: string; label: string; description: string }[];
    otherDatasets?: { label: string; description: string }[];
  },
  fieldDefs: FieldDef[]
): DatasetSchema {
  const fields: FieldSchema[] = fieldDefs.map((def) => {
    const field: FieldSchema = { name: def.name, type: def.type, description: def.description };
    const present = rows.map((r) => r[def.name]).filter((v) => v !== null && v !== undefined && v !== '');

    // Identifier / contact / geographic columns never expose their value domain (see the privacy
    // invariant above) — only the column name + type + description reach the model.
    const withhold = withholdsValueDomain(def);

    if (def.type === 'string') {
      if (withhold) return field;
      const distinct = [...new Set(present.map((v) => String(v)))];
      if (distinct.length > 0 && distinct.length <= MAX_DISTINCT_VALUES) {
        field.values = distinct.sort();
      }
    } else if (def.type === 'string[]') {
      if (withhold) return field;
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
      // A DOB range is two patients' exact birth dates — withhold it (age covers the useful signal).
      if (DOB_NAME.test(def.name)) return field;
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
    ...(meta.availableLayers?.length ? { availableLayers: meta.availableLayers } : {}),
    ...(meta.otherDatasets?.length ? { otherDatasets: meta.otherDatasets } : {}),
  };
}

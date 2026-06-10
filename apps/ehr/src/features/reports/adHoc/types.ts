import Oystehr from '@oystehr/sdk';

/** A row of a fetched ad-hoc dataset. Plain JSON — this is what the generated report code runs over. */
export type AdHocRow = Record<string, unknown>;

export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'string[]';

/**
 * Column-level metadata describing one field of the dataset. This — and ONLY this — is what we
 * send to the LLM so it can write correct code: never the actual patient rows. `values` carries a
 * categorical column's value domain (distinct values, capped); `min`/`max` describe numeric/date
 * ranges. These are descriptions of the columns, not individual patient data.
 */
export interface FieldSchema {
  name: string;
  type: FieldType;
  description: string;
  /** For low-cardinality categorical columns: the set of distinct values present (capped). */
  values?: string[];
  /** For numeric/date columns: the observed range. */
  min?: number | string;
  max?: number | string;
}

/** The full schema descriptor handed to the LLM (no rows, only column metadata). */
export interface DatasetSchema {
  datasetId: string;
  label: string;
  description: string;
  rowCount: number;
  fields: FieldSchema[];
}

export interface FetchContext {
  oystehrZambda: Oystehr;
  dateRange: { start: string; end: string };
}

/**
 * A selectable ad-hoc data source. v1 ships one (Encounters); future sources just register another
 * entry with their own fetch + schema, and the rest of the pipeline (LLM + iframe) is unchanged.
 */
export interface AdHocDataset {
  id: string;
  label: string;
  description: string;
  /** Fetch the raw rows for the date range (rows stay client-side; never sent to the LLM). */
  fetch: (ctx: FetchContext) => Promise<AdHocRow[]>;
  /** Derive the schema descriptor (column metadata + value domains) from the fetched rows. */
  buildSchema: (rows: AdHocRow[]) => DatasetSchema;
}

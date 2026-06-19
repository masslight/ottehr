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
  /** Opt-in layers that EXIST for this dataset but are NOT currently loaded. The generator returns the
   *  `id`s it needs in `needsLayers`, and the client auto-fetches them and regenerates — so a report
   *  never has to approximate a concept whose data simply wasn't loaded yet. */
  availableLayers?: { id: string; label: string; description: string }[];
  /** Other datasets the user could switch to (label + what they cover), for the same purpose. */
  otherDatasets?: { label: string; description: string }[];
}

export interface FetchContext {
  oystehrZambda: Oystehr;
  dateRange: { start: string; end: string };
  /** Selected opt-in layers, keyed by AdHocDatasetOption.id. Empty/absent for datasets without options. */
  options?: Record<string, boolean>;
}

/** An opt-in data layer a dataset can fetch (rendered as a checkbox on the ad-hoc page). Lets a
 *  report be lighter or heavier — e.g. include clinical codes / KPI timing only when needed. */
export interface AdHocDatasetOption {
  id: string;
  label: string;
  description?: string;
  default?: boolean;
}

/**
 * A selectable ad-hoc data source. Future sources just register another entry with their own fetch +
 * schema, and the rest of the pipeline (LLM + iframe) is unchanged.
 */
export interface AdHocDataset {
  id: string;
  label: string;
  description: string;
  /** Optional opt-in layers shown as checkboxes; the selected set is passed to fetch + buildSchema. */
  options?: AdHocDatasetOption[];
  /** Fetch the raw rows for the date range (rows stay client-side; never sent to the LLM). */
  fetch: (ctx: FetchContext) => Promise<AdHocRow[]>;
  /** Derive the schema descriptor (column metadata + value domains) from the fetched rows. The active
   *  options control which fields are described. */
  buildSchema: (rows: AdHocRow[], options?: Record<string, boolean>) => DatasetSchema;
}

/** One serialized cell of a table the report rendered, lifted out of the sandboxed iframe. `href` is
 *  set when the cell was a single app-internal link (so the grid can re-link it). */
export interface ExtractedCell {
  text: string;
  href?: string;
  /** Inline cell background color (e.g. a heatmap shade), carried through so the grid can re-apply it. */
  bg?: string;
}

/** A table the generated report rendered, extracted from the iframe so the parent can re-render it as
 *  a full DataGrid (sortable / filterable / exportable). Cell values are display strings; the parent
 *  infers column types for sorting. */
export interface ExtractedTable {
  /** Stable id (render order) so React keys and updates are stable across drill-down additions. */
  id: string;
  /** Heading/caption that preceded the table, used as the grid title. */
  label: string;
  columns: string[];
  rows: ExtractedCell[][];
}

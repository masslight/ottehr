// Types for the ad-hoc reporting "generate" endpoint. The LLM is given only the dataset SCHEMA
// (column metadata + value domains) and the user's request, and returns JavaScript that renders the
// report client-side. Patient rows are never sent — see the frontend payload, which carries schema
// + request only.

export interface AdHocReportTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateAdHocReportInput {
  /** Dataset schema descriptor — column metadata only, no rows. */
  schema: object;
  /** The user's natural-language report request. */
  request: string;
  /** Prior turns for refinement (e.g. user request + previously generated code, last error). */
  conversation?: AdHocReportTurn[];
}

export interface GenerateAdHocReportOutput {
  /** JavaScript (a function body over `data`, `schema`, `Chart`) that renders the report. */
  code: string;
  /** Short human-readable title for the generated report. */
  title?: string;
  /** Ids of opt-in layers the report needed but that were NOT loaded in the current fetch (drawn from
   *  the schema's `availableLayers`). The client auto-fetches these and regenerates, so the user never
   *  has to know a layer exists. Empty/absent when the loaded fetch already covered the request. */
  needsLayers?: string[];
}

// ---------------------------------------------------------------------------
// Layer inference. Before fetching, the client asks this endpoint which opt-in
// data layers a plain-language request needs, so it can fetch exactly those
// (instead of asking the user to tick checkboxes, or over-fetching everything).
// ---------------------------------------------------------------------------

export interface InferAdHocLayersInput {
  /** The active dataset id (for context only). */
  datasetId: string;
  /** The dataset's opt-in layers to choose from (id + human description). */
  layers: { id: string; label: string; description?: string }[];
  /** The user's natural-language report request. */
  request: string;
  /** Prior turns, so a refinement that introduces a new concept can pull its layer too. */
  conversation?: AdHocReportTurn[];
}

export interface InferAdHocLayersOutput {
  /** Subset of the input layer ids whose data the request needs. May be empty. */
  layerIds: string[];
}

// ---------------------------------------------------------------------------
// Saved ad-hoc reports. A saved report persists only the DEFINITION (dataset +
// fetch criteria + generated view code), never the data. Opening one re-fetches
// live data for the criteria and re-renders the stored code. Saved reports are
// practice-wide (one FHIR Basic resource each), like other admin configuration.
// ---------------------------------------------------------------------------

/** The fetch criteria for a saved report — mirrors the ad-hoc screen's date controls. */
export interface SavedAdHocReportCriteria {
  /** The date-range selector value, e.g. "last-30-days", "today", "customRange". Relative
   *  selectors recompute on open (stay live); "customRange"/"custom" stay fixed. */
  dateRange: string;
  customDate?: string;
  customStartDate?: string;
  customEndDate?: string;
  /** Selected dataset opt-in layers (checkbox state), keyed by option id. */
  options?: Record<string, boolean>;
}

/** Everything needed to reconstruct a rendered ad-hoc report — no data. */
export interface SavedAdHocReportDefinition {
  /** Tile name the provider gives the saved report. */
  name: string;
  /** Optional human-written description of what the report shows, set when saving/editing. Shown on
   *  the report tile. Distinct from `title` (the model's generated heading). */
  description?: string;
  /** Dataset id, e.g. "encounters". */
  datasetId: string;
  /** Fetch criteria (date range / filters). */
  criteria: SavedAdHocReportCriteria;
  /** Original natural-language request, kept so the report can be refined later. */
  request: string;
  /** The generated JavaScript view (reused verbatim on open). */
  code: string;
  /** Chart heading produced alongside the code. */
  title?: string;
}

/** A persisted saved report: its definition plus storage metadata. */
export interface SavedAdHocReport extends SavedAdHocReportDefinition {
  /** FHIR Basic resource id. */
  id: string;
  /** meta.lastUpdated of the backing resource. */
  updatedAt?: string;
}

export interface SaveAdHocReportInput {
  /** Present → update that saved report; absent → create a new one. Named `reportId` (not `id`)
   *  so it doesn't collide with the zambda-id key in `oystehr.zambda.execute`. */
  reportId?: string;
  definition: SavedAdHocReportDefinition;
}
export interface SaveAdHocReportOutput {
  report: SavedAdHocReport;
}

export interface ListAdHocReportsOutput {
  reports: SavedAdHocReport[];
}

export interface DeleteAdHocReportInput {
  /** See SaveAdHocReportInput.reportId for why this is `reportId` rather than `id`. */
  reportId: string;
}
export interface DeleteAdHocReportOutput {
  id: string;
}

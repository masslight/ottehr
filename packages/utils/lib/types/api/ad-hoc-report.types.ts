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
}

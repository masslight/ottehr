// A saved report persists only the definition (dataset + criteria + generated code), never data;
// opening one re-fetches live data and re-runs the code. Stored practice-wide as one FHIR Basic each.
import { z } from 'zod';

// Bump when the iframe runtime contract changes incompatibly (the execution contract the generated
// code was written against). A saved report with an older version should be regenerated from its
// prompt rather than run against a runtime it wasn't generated for.
// v1: Chart.js + raw DOM function body. v2: React/JSX over the bundled Report components.
export const ADHOC_RUNTIME_VERSION = 2;

export const SavedAdHocReportCriteriaSchema = z.object({
  dateRange: z.string(),
  customDate: z.string().optional(),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
  options: z.record(z.string(), z.boolean()).optional(),
});
export type SavedAdHocReportCriteria = z.infer<typeof SavedAdHocReportCriteriaSchema>;

export const SavedAdHocReportDefinitionSchema = z.object({
  name: z.string().min(1),
  // Shown on the tile; distinct from `title` (the model's generated heading).
  description: z.string().optional(),
  datasetId: z.string().min(1),
  criteria: SavedAdHocReportCriteriaSchema,
  // Original request, kept so the report can be edited-and-regenerated later.
  request: z.string(),
  // The generated artifact: the JSX function body, stored exactly as the model wrote it. Opening
  // re-runs it in the sandboxed iframe, which transpiles it deterministically (shared transpiler);
  // pre-JSX artifacts (plain createElement JS) pass through that transform unchanged.
  code: z.string().min(1),
  title: z.string().optional(),
  // The iframe runtime contract the code was generated against (see ADHOC_RUNTIME_VERSION).
  runtimeVersion: z.number().optional(),
});
export type SavedAdHocReportDefinition = z.infer<typeof SavedAdHocReportDefinitionSchema>;

export const SavedAdHocReportSchema = SavedAdHocReportDefinitionSchema.extend({
  id: z.string(),
  updatedAt: z.string().optional(),
});
export type SavedAdHocReport = z.infer<typeof SavedAdHocReportSchema>;

export const SaveAdHocReportInputSchema = z.object({
  // Present → update; absent → create. `reportId` avoids the zambda-id key collision.
  reportId: z.string().optional(),
  definition: SavedAdHocReportDefinitionSchema,
});
export type SaveAdHocReportInput = z.infer<typeof SaveAdHocReportInputSchema>;

export const SaveAdHocReportOutputSchema = z.object({
  report: SavedAdHocReportSchema,
});
export type SaveAdHocReportOutput = z.infer<typeof SaveAdHocReportOutputSchema>;

export const ListAdHocReportsOutputSchema = z.object({
  reports: z.array(SavedAdHocReportSchema),
});
export type ListAdHocReportsOutput = z.infer<typeof ListAdHocReportsOutputSchema>;

export const DeleteAdHocReportInputSchema = z.object({
  reportId: z.string().min(1),
});
export type DeleteAdHocReportInput = z.infer<typeof DeleteAdHocReportInputSchema>;

export const DeleteAdHocReportOutputSchema = z.object({
  id: z.string(),
});
export type DeleteAdHocReportOutput = z.infer<typeof DeleteAdHocReportOutputSchema>;

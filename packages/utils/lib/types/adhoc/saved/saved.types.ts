// A saved report persists only the definition (what to fetch + generated code), never data; opening one
// re-fetches live data and re-runs the code. Stored practice-wide as one FHIR Basic each. Two shapes:
//   - a FETCH PLAN report (new): `plan` + `inputs`; the plan runs through the shared runner.
//   - a DATASET report (saved before plans): `datasetId` + `criteria`; it keeps running on its dataset.
import { z } from 'zod';
import { FetchPlanSchema } from '../plan/fetch-plan';

// Bump when the iframe runtime contract changes incompatibly (the execution contract the generated
// code was written against). A saved report with an older version should be regenerated from its
// prompt rather than run against a runtime it wasn't generated for.
export const ADHOC_RUNTIME_VERSION = 3;

export const SavedAdHocReportCriteriaSchema = z.object({
  dateRange: z.string(),
  customDate: z.string().optional(),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
  options: z.record(z.string(), z.boolean()).optional(),
});
export type SavedAdHocReportCriteria = z.infer<typeof SavedAdHocReportCriteriaSchema>;

/** A dateRange input's default: a relative filter of the date picker, or custom yyyy-MM-dd days. */
export const DateRangeInputDefaultSchema = z.union([
  z.object({ preset: z.string().min(1) }),
  z.object({ start: z.string().min(1), end: z.string().min(1) }),
]);
export type DateRangeInputDefault = z.infer<typeof DateRangeInputDefaultSchema>;

/** A value the screen running a plan report supplies: its date range (fills {{start}} / {{end}}) or an id such as the patient. */
export const SavedAdHocReportInputSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'input name must be an identifier'),
  kind: z.enum(['dateRange', 'id']),
  required: z.boolean(),
  /** For a dateRange input: what its picker starts on (DateRangeInputDefaultSchema). */
  default: z.unknown().optional(),
});
export type SavedAdHocReportInput = z.infer<typeof SavedAdHocReportInputSchema>;

export const SavedAdHocReportDefinitionSchema = z
  .object({
    name: z.string().min(1),
    // Shown on the tile; distinct from `title` (the model's generated heading).
    description: z.string().optional(),
    // Dataset reports only.
    datasetId: z.string().min(1).optional(),
    criteria: SavedAdHocReportCriteriaSchema.optional(),
    // Plan reports only: the searches the report runs, and the values the screen running it supplies.
    plan: FetchPlanSchema.optional(),
    inputs: z.array(SavedAdHocReportInputSchema).optional(),
    // Original request, kept so the report can be edited-and-regenerated later.
    request: z.string(),
    // The generated artifact: the JSX function body, stored exactly as the model wrote it. Opening
    // re-runs it in the sandboxed iframe, which transpiles it deterministically (shared transpiler);
    // pre-JSX artifacts (plain createElement JS) pass through that transform unchanged.
    code: z.string().min(1),
    title: z.string().optional(),
    // The iframe runtime contract the code was generated against (see ADHOC_RUNTIME_VERSION).
    runtimeVersion: z.number().optional(),
    // Written after each run of a plan report (plan/fetch-mode.ts): a direct call when the last run was fast
    // over a range no wider than measured, else the background Task.
    fetchMode: z.enum(['direct', 'task']).optional(),
    measuredFetchSeconds: z.number().optional(),
    measuredRangeDays: z.number().optional(),
  })
  .refine((definition) => !!definition.plan || (!!definition.datasetId && !!definition.criteria), {
    message: 'a saved report needs a plan, or a datasetId with its criteria',
  });
export type SavedAdHocReportDefinition = z.infer<typeof SavedAdHocReportDefinitionSchema>;

export const SavedAdHocReportSchema = SavedAdHocReportDefinitionSchema.innerType().extend({
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

// "Generate report" endpoint contract. The model gets the serialized schema + request and writes
// React/JSX. That JSX is the single artifact: the endpoint returns it (validating shape only, never
// executing), the preview shows it, saved reports persist it, the auto-repair prompt quotes it. It's
// validated where it runs — the sandboxed iframe transpiles (./transpile) and executes it over real
// rows; a runtime failure returns via `previousAttempt` through the client's bounded auto-repair. No
// user-facing refinement: the user edits the prompt and regenerates.
import { z } from 'zod';
import { LlmDatasetSchemaSchema } from '../datasets/llm-schema';

export const GenerateAdHocReportInputSchema = z.object({
  schema: LlmDatasetSchemaSchema,
  request: z.string().min(1),
  // Set by the app when the previous generation crashed at runtime — gives the model the failing
  // JSX + error to fix. Never set by the user.
  previousAttempt: z
    .object({
      code: z.string().min(1),
      error: z.string().min(1),
    })
    .optional(),
});
export type GenerateAdHocReportInput = z.infer<typeof GenerateAdHocReportInputSchema>;

export const GenerateAdHocReportOutputSchema = z.object({
  // The generated artifact: the JSX function body (validated; iframe transpiles it at render).
  code: z.string().min(1),
  title: z.string().optional(),
  // Opt-in layer ids the report needed but weren't loaded; the client auto-fetches + regenerates.
  needsLayers: z.array(z.string()).optional(),
});
export type GenerateAdHocReportOutput = z.infer<typeof GenerateAdHocReportOutputSchema>;

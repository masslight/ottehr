// "Generate report" endpoint contract. The model gets the serialized schema + request and writes
// React/JSX. That JSX is the single artifact: the endpoint returns it (validating shape only, never
// executing), the preview shows it, saved reports persist it, the auto-repair prompt quotes it. It's
// validated where it runs — the sandboxed iframe transpiles (./transpile) and executes it over real
// rows; a runtime failure returns via `previousAttempt` through the client's bounded auto-repair. No
// user-facing refinement: the user edits the prompt and regenerates.
import { z } from 'zod';
import {
  CLAUDE_OPUS_5_5_MODEL,
  CLAUDE_SONNET_5_5_MODEL,
  LlmModel,
  VERTEX_AI_MODEL,
} from '../../api/ai-models.constants';
import { LlmDatasetSchemaSchema } from '../datasets/llm-schema';

export const AD_HOC_REPORT_MODELS = ['defaultVertexModel', 'claudeSonnet_5_5', 'claudeOpus_5_5'] as const;
export type AdHocReportModel = (typeof AD_HOC_REPORT_MODELS)[number];
export const AD_HOC_REPORT_DEFAULT_MODEL: AdHocReportModel = 'defaultVertexModel';

export const AD_HOC_REPORT_LLM_MODELS: Record<AdHocReportModel, LlmModel> = {
  defaultVertexModel: VERTEX_AI_MODEL,
  claudeSonnet_5_5: CLAUDE_SONNET_5_5_MODEL,
  claudeOpus_5_5: CLAUDE_OPUS_5_5_MODEL,
};

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
  model: z.enum(AD_HOC_REPORT_MODELS).optional(),
});
export type GenerateAdHocReportInput = z.infer<typeof GenerateAdHocReportInputSchema>;

export const GenerateAdHocReportOutputSchema = z.object({
  // The generated artifact: the JSX function body (validated; iframe transpiles it at render).
  code: z.string().min(1),
  title: z.string().optional(),
  // Opt-in layer ids the report needed but weren't loaded; the client auto-fetches + regenerates.
  needsLayers: z.array(z.string()).optional(),
  needsDataset: z.object({ id: z.string(), concepts: z.array(z.string()) }).optional(),
});
export type GenerateAdHocReportOutput = z.infer<typeof GenerateAdHocReportOutputSchema>;

// Async flow: { ...GenerateAdHocReportInput } starts a generation Task and returns { taskId };
// { taskId } polls its status until the generated report (or an error) is ready.
export const GetAdHocGenerationStatusInputSchema = z.object({ taskId: z.string().min(1) });

export type GetAdHocGenerationStatusInput = z.infer<typeof GetAdHocGenerationStatusInputSchema>;

export const AdHocGenerationStatusSchema = z.object({
  status: z.enum(['requested', 'in-progress', 'completed', 'failed']),
  result: GenerateAdHocReportOutputSchema.optional(),
  error: z.string().optional(),
});

export type AdHocGenerationStatus = z.infer<typeof AdHocGenerationStatusSchema>;

import { z } from 'zod';
import { ServiceMode } from '../../common';

export const FlowServiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  ottehrManagedService: z.boolean(),
});

export const FlowFormSchema = z.object({
  id: z.string(),
  url: z.string(),
  label: z.string(),
});

export const PaperworkFlowBaseSchema = z.object({
  name: z.string(),
  /** Forms included in this flow */
  forms: z.array(FlowFormSchema),
  /** Visit modes this flow targets. */
  modes: z.array(z.nativeEnum(ServiceMode)),
});

/** status mirrors Questionnaire['status'] from fhir/r4b */
const QuestionnaireStatusSchema = z.enum(['draft', 'active', 'retired', 'unknown']);

export const PaperworkFlowQuestionnaireSchema = PaperworkFlowBaseSchema.extend({
  qId: z.string(),
  url: z.string(),
  version: z.string(),
  status: QuestionnaireStatusSchema,
});

export const PaperworkFlowSchema = PaperworkFlowQuestionnaireSchema.extend({
  services: z.array(FlowServiceSchema),
});

// ============= api input / output schemas ===============

export const PaperworkFlowCreateInputSchema = z.object({
  flow: PaperworkFlowBaseSchema,
  flowServices: z.array(FlowServiceSchema),
});

export const PaperworkFlowUpdateInputSchema = PaperworkFlowCreateInputSchema.extend({
  flowId: z.string(),
});

export const PaperworkFlowDeleteInputSchema = z.object({
  flowId: z.string(),
});

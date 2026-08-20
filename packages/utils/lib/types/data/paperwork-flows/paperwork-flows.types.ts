import { z } from 'zod';
import {
  FlowFormSchema,
  FlowServiceSchema,
  PaperworkFlowBaseSchema,
  PaperworkFlowCreateInputSchema,
  PaperworkFlowDeleteInputSchema,
  PaperworkFlowQuestionnaireSchema,
  PaperworkFlowSchema,
  PaperworkFlowUpdateInputSchema,
} from './paperwork-flows.schema';

export type FlowService = z.infer<typeof FlowServiceSchema>;

export type FlowForm = z.infer<typeof FlowFormSchema>;

export type PaperworkFlowBase = z.infer<typeof PaperworkFlowBaseSchema>;

export type PaperworkFlowQuestionnaire = z.infer<typeof PaperworkFlowQuestionnaireSchema>;

export type PaperworkFlow = z.infer<typeof PaperworkFlowSchema>;

// ============= api input / output types ===============

export interface PaperworkFlowListOutput {
  flows: PaperworkFlow[];
  ottehrManagedQuestionnaires: FlowForm[];
}

export type PaperworkFlowCreateInput = z.infer<typeof PaperworkFlowCreateInputSchema>;

export type PaperworkFlowUpdateInput = z.infer<typeof PaperworkFlowUpdateInputSchema>;

export type PaperworkFlowDeleteInput = z.infer<typeof PaperworkFlowDeleteInputSchema>;

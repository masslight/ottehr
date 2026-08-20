import { DynamicPopulationSchema, FormFieldTriggerSchema, QuestionnaireBaseSchema } from 'config-types';
import z from 'zod';
import {
  OTTEHR_DATA_TYPES,
  OTTEHR_INPUT_WIDTHS,
  OTTEHR_PREFERRED_ELEMENTS,
  QUESTIONNAIRE_ITEM_TYPES,
} from './practice-managed-questionnaire.types';

export const DataTypeSchema = z.enum(OTTEHR_DATA_TYPES);
export const InputWidthSchema = z.enum(OTTEHR_INPUT_WIDTHS);
export const PreferredElementSchema = z.enum(OTTEHR_PREFERRED_ELEMENTS);
// Only 'hidden'/'protected' actually render; the config DSL also allows 'disabled' but it is coerced to
// 'protected' on emit and dropped on parse, so the builder does not offer it.
export const DisabledDisplaySchema = z.enum(['hidden', 'protected']);

export const PracticeManagedQuestionnaireItemSchema = z
  .object({
    linkId: z.string(),
    type: z.enum(QUESTIONNAIRE_ITEM_TYPES),
    // these are custom fields that will be mapped to questionnaire extension when converted to fhir format
    dataType: DataTypeSchema.optional(),
    inputWidth: InputWidthSchema.optional(),
    // additional custom fields mapped to Ottehr item extensions (see practice-managed-questionnaires/index.ts)
    infoText: z.string().optional(),
    secondaryInfoText: z.string().optional(),
    preferredElement: PreferredElementSchema.optional(),
    attachmentText: z.string().optional(),
    minRows: z.number().int().positive().optional(),
    // conditional-behavior fields, compiled to enableWhen + the *-when / disabled-display / fill-from-when-disabled
    // extensions (see practice-managed-questionnaires/index.ts). Reuse the config DSL schemas.
    triggers: z.array(FormFieldTriggerSchema).optional(),
    dynamicPopulation: DynamicPopulationSchema.optional(),
    disabledDisplay: DisabledDisplaySchema.optional(),
    hideControlLabel: z.boolean().optional(),
    // custom field needed for react stability
    _key: z.string().length(8),
  })
  .passthrough();

export const PracticeManagedQuestionnaireSchema = QuestionnaireBaseSchema.extend({
  item: PracticeManagedQuestionnaireItemSchema.array(),
}).passthrough();

export const PracticeManagedQuestionnaireUpdateStatusSchema = z.object({
  questionnaireId: z.string().uuid(),
  newStatus: z.enum(['draft', 'active', 'retired', 'unknown']),
});

export const GetStandAlonePaperworkInputSchema = z.object({
  questionnaireResponseId: z.string().uuid(),
});

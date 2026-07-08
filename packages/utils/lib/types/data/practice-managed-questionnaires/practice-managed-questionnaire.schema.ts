import { QuestionnaireBaseSchema } from 'config-types';
import z from 'zod';
import {
  OTTEHR_DATA_TYPES,
  OTTEHR_INPUT_WIDTHS,
  QUESTIONNAIRE_ITEM_TYPES,
} from './practice-managed-questionnaire.types';

export const DataTypeSchema = z.enum(OTTEHR_DATA_TYPES);
export const InputWidthSchema = z.enum(OTTEHR_INPUT_WIDTHS);

export const PracticeManagedQuestionnaireItemSchema = z
  .object({
    linkId: z.string(),
    type: z.enum(QUESTIONNAIRE_ITEM_TYPES),
    // these are custom fields that will be mapped to questionnaire extension when converted to fhir format
    dataType: DataTypeSchema.optional(),
    inputWidth: InputWidthSchema.optional(),
    // custom field needed for react stability
    _key: z.string().length(8),
  })
  .passthrough();

export const PracticeManagedQuestionnaireSchema = QuestionnaireBaseSchema.omit({ version: true })
  .extend({
    item: PracticeManagedQuestionnaireItemSchema.array(),
  })
  .passthrough();

export const PracticeManagedQuestionnaireUpdateStatusSchema = z.object({
  questionnaireId: z.string().uuid(),
  newStatus: z.enum(['draft', 'active', 'retired', 'unknown']),
});

export const GetStandAlonePaperworkInputSchema = z.object({
  questionnaireResponseId: z.string().uuid(),
});

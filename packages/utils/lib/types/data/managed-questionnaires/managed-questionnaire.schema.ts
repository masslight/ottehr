import z from 'zod';
import { OTTEHR_DATA_TYPES, OTTEHR_INPUT_WIDTHS, QUESTIONNAIRE_ITEM_TYPES } from './managed-questionnaire.types';

export const DataTypeSchema = z.enum(OTTEHR_DATA_TYPES);
export const InputWidthSchema = z.enum(OTTEHR_INPUT_WIDTHS);

export const ManagedQuestionnaireItemSchema = z
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

export const ManagedQuestionnaireSchema = z
  .object({
    resourceType: z.literal('Questionnaire'),
    status: z.enum(['draft', 'active', 'retired', 'unknown']),
    name: z.string(),
    title: z.string(),
    url: z.string(),
    item: ManagedQuestionnaireItemSchema.array(),
  })
  .passthrough();

export const ManagedQuestionnaireUpdateStatusSchema = z.object({
  questionnaireId: z.string().uuid(),
  newStatus: z.enum(['draft', 'active', 'retired', 'unknown']),
});

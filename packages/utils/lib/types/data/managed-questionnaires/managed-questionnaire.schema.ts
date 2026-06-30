import { QuestionnaireBaseSchema } from 'config-types';
import { QuestionnaireResponseItem } from 'fhir/r4b';
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

export const ManagedQuestionnaireSchema = QuestionnaireBaseSchema.omit({ version: true })
  .extend({
    item: ManagedQuestionnaireItemSchema.array(),
  })
  .passthrough();

export const ManagedQuestionnaireUpdateStatusSchema = z.object({
  questionnaireId: z.string().uuid(),
  newStatus: z.enum(['draft', 'active', 'retired', 'unknown']),
});

export const GetAllManagedPaperworkInputSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const GetManagedPaperworkForQuestionnaire = GetAllManagedPaperworkInputSchema.extend({
  questionnaireId: z.string().uuid(),
});

export const SaveManagedPaperworkResponseInputSchema = z.object({
  pageAnswers: z.custom<QuestionnaireResponseItem>(),
  questionnaireId: z.string().uuid(),
  // we could probably deduce "complete" from the questionnaire and answers but for simplicity sake passing from the front end for now
  complete: z.boolean(),
  appointmentId: z.string().uuid(),
  // computedQrItems -- idea is that i will send this and if the zambda gets them it knows to add them as another field
});

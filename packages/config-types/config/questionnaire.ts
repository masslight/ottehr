import z from 'zod';

/**
 * QuestionnaireDataType - Data types for questionnaire fields
 * Used to indicate special handling/validation for form inputs
 */
export const QuestionnaireDataTypes = [
  'ZIP',
  'Email',
  'Phone Number',
  'DOB',
  'Signature',
  'Image',
  'PDF',
  'Payment Validation',
  'Medical History',
  'Call Out',
  'SSN',
] as const;

export const QuestionnaireDataTypeSchema = z.enum(QuestionnaireDataTypes);
export type QuestionnaireDataType = z.infer<typeof QuestionnaireDataTypeSchema>;

/**
 * QuestionnaireBase - Base FHIR Questionnaire metadata
 * Defines the core identity fields for a questionnaire resource
 */
export const QuestionnaireBaseSchema = z.object({
  resourceType: z.literal('Questionnaire'),
  url: z.string(),
  version: z.string(),
  name: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'active', 'retired', 'unknown']),
});

export type QuestionnaireBase = z.infer<typeof QuestionnaireBaseSchema>;

/**
 * TriggerEffect - Effects that can be applied when a trigger condition is met
 */
export const TriggerEffectSchema = z.enum(['enable', 'require', 'filter', 'sub-text']);
export type TriggerEffect = z.infer<typeof TriggerEffectSchema>;

/**
 * FormFieldTrigger - Conditional logic for form fields
 * Defines when fields should be enabled, required, filtered, or have text substituted
 */
export const FormFieldTriggerSchema = z
  .object({
    targetQuestionLinkId: z.string(),
    effect: z.array(TriggerEffectSchema),
    operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
    answerBoolean: z.boolean().optional(),
    answerString: z.string().optional(),
    answerDateTime: z.string().optional(),
    substituteText: z.string().optional(),
  })
  .refine(
    (data) => {
      const definedAnswers = [data.answerBoolean, data.answerString, data.answerDateTime].filter(
        (answer) => answer !== undefined
      );
      return definedAnswers.length === 1;
    },
    {
      message: 'Exactly one of answerBoolean, answerString, or answerDateTime must be defined',
    }
  )
  .refine(
    (data) => {
      const hasSubTextEffect = data.effect.includes('sub-text');
      if (hasSubTextEffect) {
        return data.substituteText !== undefined;
      }
      return true;
    },
    {
      message: 'substituteText must be defined when effect includes sub-text',
    }
  );

export type FormFieldTrigger = z.infer<typeof FormFieldTriggerSchema>;

/**
 * FormFieldOption - Option for choice/select fields
 */
export const FormFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;

/*
 * TODO: Additional questionnaire form field schemas to extract:
 *
 * - FormFieldsLogicalFieldSchema
 * - FormFieldsDisplayFieldSchema
 * - FormFieldsValueTypeSchema
 * - FormFieldsAttachmentFieldSchema
 * - FormFieldsGroupFieldSchema
 * - FormSectionSimpleSchema
 * - FormSectionArraySchema
 * - QuestionnaireConfigSchema
 *
 * These have dependencies on:
 * - AnswerOptionSourceSchema (depends on FhirResourceTypeSchema - large enum)
 * - VALUE_SETS (runtime config dependency)
 *
 * Consider whether to:
 * 1. Move AnswerOptionSourceSchema to config-types
 * 2. Use z.unknown() for now and refine later
 */

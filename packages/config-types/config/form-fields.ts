import z from 'zod';
import { AnswerOptionSourceSchema } from './fhir';
import {
  FormFieldOptionSchema,
  type FormFieldTrigger,
  FormFieldTriggerSchema,
  QuestionnaireDataTypeSchema,
} from './questionnaire';

// Re-export for convenience
export { FormFieldTriggerSchema } from './questionnaire';
export type { FormFieldTrigger } from './questionnaire';

/**
 * DynamicPopulation - Configuration for auto-populating fields
 */
export const DynamicPopulationSchema = z.object({
  sourceLinkId: z.string(),
  // currently only supporting population when disabled
  triggerState: z.literal('disabled').optional().default('disabled'),
});

export type DynamicPopulation = z.infer<typeof DynamicPopulationSchema>;

/**
 * ReferenceDataSource - Configuration for loading reference data
 * Either answerSource (FHIR query) or valueSet must be provided
 */
export const ReferenceDataSourceSchema = z
  .object({
    answerSource: AnswerOptionSourceSchema.optional(),
    valueSet: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.answerSource !== undefined || data.valueSet !== undefined;
    },
    {
      message: 'Either answerSource or valueSet must be provided',
    }
  );

export type ReferenceDataSource = z.infer<typeof ReferenceDataSourceSchema>;

/**
 * FormFieldsLogicalField - Hidden/logical fields for internal state
 * These are not displayed to users but carry data through the form
 */
export const FormFieldsLogicalFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'date', 'boolean', 'choice', 'open-choice']),
  required: z.boolean().optional().default(true),
  dataType: QuestionnaireDataTypeSchema.optional(),
  initialValue: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(FormFieldOptionSchema).optional(),
});

export type FormFieldsLogicalItem = z.infer<typeof FormFieldsLogicalFieldSchema>;

/**
 * FormFieldsDisplayField - Display-only text fields (headers, paragraphs)
 */
export const FormFieldsDisplayFieldSchema = z.object({
  key: z.string(),
  type: z.literal('display'),
  text: z.string(),
  element: z.enum(['h3', 'h4', 'p']).optional(),
  dataType: QuestionnaireDataTypeSchema.optional(),
  triggers: z.array(FormFieldTriggerSchema).optional(),
  enableBehavior: z.enum(['all', 'any']).default('any').optional(),
  disabledDisplay: z.literal('hidden').optional().default('hidden'),
});

export type FormFieldsDisplayItem = z.infer<typeof FormFieldsDisplayFieldSchema>;

/**
 * FormFieldsValueTypeBase - Base schema for input fields
 * Contains all common properties for value-bearing fields
 */
export const FormFieldsValueTypeBaseSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'text', 'date', 'choice', 'open-choice', 'boolean', 'reference', 'decimal']),
  label: z.string(),
  dataType: QuestionnaireDataTypeSchema.optional(),
  options: z.array(FormFieldOptionSchema).optional(),
  dataSource: ReferenceDataSourceSchema.optional(),
  triggers: z.array(FormFieldTriggerSchema).optional(),
  dynamicPopulation: DynamicPopulationSchema.optional(),
  enableBehavior: z.enum(['all', 'any']).default('any').optional(),
  disabledDisplay: z.enum(['hidden', 'disabled']).default('hidden'),
  initialValue: z.union([z.string(), z.boolean()]).optional(),
  inputWidth: z.enum(['s', 'm', 'l']).optional(),
  autocomplete: z.string().optional(),
  permissibleValue: z.union([z.boolean(), z.string()]).optional(),
  placeholder: z.string().optional(),
  infoTextSecondary: z.string().optional(),
  element: z.string().optional(),
  acceptsMultipleAnswers: z.boolean().optional(),
  customLinkId: z.string().optional(),
  categoryTag: z.string().optional(),
  alwaysFilter: z.boolean().optional(),
});

/**
 * FormFieldsValueType - Input field with validation refinements
 * - choice/open-choice types require options
 * - reference types require dataSource
 */
export const FormFieldsValueTypeSchema = FormFieldsValueTypeBaseSchema.refine(
  (data) => {
    if (data.type === 'choice' || data.type === 'open-choice') {
      return Array.isArray(data.options);
    }
    return true;
  },
  {
    message: 'Options must be provided for choice and open-choice types',
  }
).refine(
  (data) => {
    if (data.type === 'reference') {
      return data.dataSource !== undefined;
    }
    return true;
  },
  {
    message: 'dataSource must be provided for reference types',
  }
);

export type FormFieldsValueType = z.infer<typeof FormFieldsValueTypeSchema>;

/**
 * FormFieldsAttachmentField - File attachment fields
 */
export const FormFieldsAttachmentFieldSchema = FormFieldsValueTypeBaseSchema.extend({
  type: z.literal('attachment'),
  attachmentText: z.string().optional(),
  documentType: z.string().optional(),
});

export type FormFieldsAttachmentItem = z.infer<typeof FormFieldsAttachmentFieldSchema>;

// Input item is either a value type or attachment type
export type FormFieldsInputItem = FormFieldsValueType | FormFieldsAttachmentItem;

/**
 * FormFieldsGroupItem - TypeScript type for group fields
 * Manually defined for proper type inference with recursive structure
 */
export type FormFieldsGroupItem = {
  key: string;
  type: 'group';
  text?: string;
  required?: boolean;
  items: Record<string, FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsAttachmentItem | FormFieldsGroupItem>;
  requiredFields?: string[];
  triggers?: z.infer<typeof FormFieldTriggerSchema>[];
  enableBehavior?: 'all' | 'any';
  extension?: unknown[];
  customLinkId?: string;
  categoryTag?: string;
  acceptsMultipleAnswers?: boolean;
  groupType?: 'list-with-form' | 'pharmacy-collection';
  disabledDisplay?: 'hidden';
};

/**
 * FormFieldsGroupField - Nested group of fields (recursive)
 * Uses z.lazy() to handle recursive structure
 * Input type is 'unknown' since .default() modifiers make input types differ from output
 */
export const FormFieldsGroupFieldSchema: z.ZodType<FormFieldsGroupItem, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    key: z.string(),
    type: z.literal('group'),
    text: z.string().optional(),
    required: z.boolean().optional(),
    items: z.record(
      z.union([
        FormFieldsValueTypeSchema,
        FormFieldsDisplayFieldSchema,
        FormFieldsAttachmentFieldSchema,
        FormFieldsGroupFieldSchema,
      ])
    ),
    requiredFields: z.array(z.string()).optional(),
    triggers: z.array(FormFieldTriggerSchema).optional(),
    enableBehavior: z.enum(['all', 'any']).default('any').optional(),
    extension: z.array(z.any()).optional(),
    customLinkId: z.string().optional(),
    categoryTag: z.string().optional(),
    acceptsMultipleAnswers: z.boolean().optional(),
    groupType: z.enum(['list-with-form', 'pharmacy-collection']).optional(),
    disabledDisplay: z.literal('hidden').optional().default('hidden'),
  })
) as z.ZodType<FormFieldsGroupItem, z.ZodTypeDef, unknown>;

/**
 * FormFieldsItem - Union of all field item types
 */
export type FormFieldsItem = FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsGroupItem;

/**
 * FormFieldItemRecord - Record/dictionary of form field items
 * Manually defined for type consistency across the codebase
 */
export type FormFieldItemRecord = Record<string, FormFieldsItem>;

export const FormFieldItemRecordSchema: z.ZodType<FormFieldItemRecord, z.ZodTypeDef, unknown> = z.record(
  z.union([
    FormFieldsValueTypeSchema,
    FormFieldsDisplayFieldSchema,
    FormFieldsAttachmentFieldSchema,
    FormFieldsGroupFieldSchema,
  ])
);

/**
 * FormFieldLogicalItemRecord - Record of logical/hidden items
 */
export const FormFieldLogicalItemRecordSchema = z.record(FormFieldsLogicalFieldSchema);

export type FormFieldLogicalItemRecord = z.infer<typeof FormFieldLogicalItemRecordSchema>;

/**
 * ComplexValidation - Configuration for complex validation rules
 */
export const ComplexValidationTriggerWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answer: z.string(),
});

export const ComplexValidationSchema = z.object({
  type: z.string(),
  triggerWhen: ComplexValidationTriggerWhenSchema,
});

export type ComplexValidation = z.infer<typeof ComplexValidationSchema>;

/**
 * FormSectionSimple - A single form section with fields
 * Manually defined for type consistency
 */
export interface FormSectionSimple {
  linkId: string;
  title: string;
  items: FormFieldItemRecord;
  logicalItems?: FormFieldLogicalItemRecord;
  hiddenFields?: string[];
  requiredFields?: string[];
  enableBehavior?: 'all' | 'any';
  reviewText?: string;
  complexValidation?: ComplexValidation;
  element?: string;
  triggers?: FormFieldTrigger[];
}

export const FormSectionSimpleSchema: z.ZodType<FormSectionSimple, z.ZodTypeDef, unknown> = z.object({
  linkId: z.string(),
  title: z.string(),
  items: FormFieldItemRecordSchema,
  logicalItems: FormFieldLogicalItemRecordSchema.optional(),
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  enableBehavior: z.enum(['all', 'any']).optional(),
  reviewText: z.string().optional(),
  complexValidation: ComplexValidationSchema.optional(),
  element: z.string().optional(),
  triggers: z.array(FormFieldTriggerSchema).optional(),
});

/**
 * FormSectionArray - Array-based sections (like insurance with multiple entries)
 * Manually defined for type consistency
 */
export interface FormSectionArray {
  linkId: string[];
  title: string;
  items: FormFieldItemRecord[];
  logicalItems?: FormFieldLogicalItemRecord;
  hiddenFields?: string[];
  requiredFields?: string[];
  enableBehavior?: 'all' | 'any';
  reviewText?: string;
  complexValidation?: ComplexValidation;
  element?: string;
  triggers?: FormFieldTrigger[];
}

export const FormSectionArraySchema: z.ZodType<FormSectionArray, z.ZodTypeDef, unknown> = z.object({
  linkId: z.array(z.string()),
  title: z.string(),
  items: z.array(FormFieldItemRecordSchema),
  logicalItems: FormFieldLogicalItemRecordSchema.optional(),
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  enableBehavior: z.enum(['all', 'any']).optional(),
  reviewText: z.string().optional(),
  complexValidation: ComplexValidationSchema.optional(),
  element: z.string().optional(),
  triggers: z.array(FormFieldTriggerSchema).optional(),
});

/**
 * FormFieldSection - Union of simple and array sections
 */
export type FormFieldSection = FormSectionSimple | FormSectionArray;

/**
 * QuestionnaireConfig - Top-level configuration for a questionnaire form
 */
export const QuestionnaireConfigSchema = z.object({
  questionnaireBase: z.object({
    resourceType: z.literal('Questionnaire'),
    url: z.string(),
    version: z.string(),
    name: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'active', 'retired', 'unknown']),
  }),
  hiddenFormSections: z.array(z.string()),
  FormFields: z.record(z.string(), z.union([FormSectionSimpleSchema, FormSectionArraySchema])),
});

export type QuestionnaireConfigType = z.infer<typeof QuestionnaireConfigSchema>;

import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import z from 'zod';
import { AnswerOptionSourceSchema, QuestionnaireDataTypeSchema } from '../types/data/paperwork/paperwork.types';

const triggerEffectSchema = z.enum(['enable', 'require', 'filter']);
const triggerSchema = z
  .object({
    targetQuestionLinkId: z.string(),
    effect: z.array(triggerEffectSchema),
    operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
    answerBoolean: z.boolean().optional(),
    answerString: z.string().optional(),
    answerDateTime: z.string().optional(),
  })
  .refine(
    (data) => {
      const definedAnswers = [data.answerBoolean, data.answerString, data.answerDateTime].filter(
        (answer) => answer !== undefined
      );
      return definedAnswers.length === 1;
    },
    {
      message: 'Exactly one of answerBoolean, answerString, or answerDecimal must be defined',
    }
  );

export type FormFieldTrigger = z.infer<typeof triggerSchema>;

const dynamicPopulationSchema = z.object({
  sourceLinkId: z.string(),
  // currently only supporting population when disabled, could see this evolve to a more flexible system where the trigger eval logic kicks off dynamic population
  triggerState: z.literal('disabled').optional().default('disabled'),
});

const ReferenceDataSourceSchema = z
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
const FormFieldsLogicalFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'date', 'boolean', 'choice']),
  required: z.boolean().optional().default(true),
  dataType: QuestionnaireDataTypeSchema.optional(),
  initialValue: z.union([z.string(), z.boolean()]).optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
});

const TextWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answer: z.string(),
  substituteText: z.string(),
});

const FormFieldsDisplayFieldSchema = z.object({
  key: z.string(),
  type: z.literal('display'),
  text: z.string(),
  element: z.enum(['h3', 'p']).optional(),
  triggers: z.array(triggerSchema).optional(),
  enableBehavior: z.enum(['all', 'any']).default('any').optional(),
  textWhen: z.array(TextWhenSchema).optional(),
  disabledDisplay: z.literal('hidden').optional().default('hidden'),
});

const FormFieldsValueTypeBaseSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'text', 'date', 'choice', 'boolean', 'reference']),
  label: z.string(),
  dataType: QuestionnaireDataTypeSchema.optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  dataSource: ReferenceDataSourceSchema.optional(),
  triggers: z.array(triggerSchema).optional(),
  dynamicPopulation: dynamicPopulationSchema.optional(),
  enableBehavior: z.enum(['all', 'any']).default('any').optional(),
  disabledDisplay: z.enum(['hidden', 'disabled', 'protected']).default('disabled'),
  initialValue: z.union([z.string(), z.boolean()]).optional(),
  inputWidth: z.enum(['s', 'm', 'l']).optional(),
  autocomplete: z.string().optional(),
  permissibleValue: z.union([z.boolean(), z.string()]).optional(),
  placeholder: z.string().optional(),
  infoTextSecondary: z.string().optional(),
  element: z.string().optional(),
});

const FormFieldsValueTypeSchema = FormFieldsValueTypeBaseSchema.refine(
  (data) => {
    if (data.type === 'choice') {
      return (
        Array.isArray(data.options) || {
          message: 'Options must be provided for choice types',
        }
      );
    }
    return true;
  },
  {
    message: 'Options must be provided for choice types',
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

const FormFieldsAttachmentFieldSchema = FormFieldsValueTypeBaseSchema.extend({
  type: z.literal('attachment'),
  attachmentText: z.string().optional(),
  documentType: z.string().optional(),
});

export type FormFieldsDisplayItem = z.infer<typeof FormFieldsDisplayFieldSchema>;
export type FormFieldsAttachmentItem = z.infer<typeof FormFieldsAttachmentFieldSchema>;
export type FormFieldsLogicalItem = z.infer<typeof FormFieldsLogicalFieldSchema>;
export type FormFieldsInputItem = z.infer<typeof FormFieldsValueTypeSchema> | FormFieldsAttachmentItem;

// Nested group schema - uses z.lazy() for recursion
// Using z.ZodType<any> to avoid complex circular type inference issues
const FormFieldsGroupFieldSchema = z.lazy(() =>
  z.object({
    key: z.string(),
    type: z.literal('group'),
    text: z.string().optional(),
    items: z.record(
      z.union([
        FormFieldsValueTypeSchema,
        FormFieldsDisplayFieldSchema,
        FormFieldsAttachmentFieldSchema,
        FormFieldsGroupFieldSchema,
      ])
    ),
    triggers: z.array(triggerSchema).optional(),
    enableBehavior: z.enum(['all', 'any']).default('any').optional(),
    extension: z.array(z.any()).optional(),
  })
) as z.ZodType<any>;

// Define the TypeScript type for group field manually (for proper type inference)
export type FormFieldsGroupItem = {
  key: string;
  type: 'group';
  text?: string;
  items: Record<string, FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsAttachmentItem | FormFieldsGroupItem>;
  triggers?: FormFieldTrigger[];
  enableBehavior?: 'all' | 'any';
  extension?: any[];
};

export type FormFieldsItem = FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsGroupItem;

export const FormFieldItemRecordSchema = z.record(
  z.union([
    FormFieldsValueTypeSchema,
    FormFieldsDisplayFieldSchema,
    FormFieldsAttachmentFieldSchema,
    FormFieldsGroupFieldSchema,
  ])
);
export type FormFieldItemRecord = z.infer<typeof FormFieldItemRecordSchema>;
export const FormFieldLogicalItemRecordSchema = z.record(FormFieldsLogicalFieldSchema);
export type FormFieldLogicalItemRecord = z.infer<typeof FormFieldLogicalItemRecordSchema>;
const GroupLevelEnableWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answerBoolean: z.boolean().optional(),
  answerString: z.string().optional(),
  answerDateTime: z.string().optional(),
});

const ComplexValidationTriggerWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answer: z.string(),
});

const ComplexValidationSchema = z.object({
  type: z.string(),
  triggerWhen: ComplexValidationTriggerWhenSchema,
});

export const FormSectionSimpleSchema = z.object({
  linkId: z.string(),
  title: z.string(),
  items: FormFieldItemRecordSchema,
  logicalItems: FormFieldLogicalItemRecordSchema.optional(),
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  // Group-level properties
  enableWhen: z.array(GroupLevelEnableWhenSchema).optional(),
  enableBehavior: z.enum(['all', 'any']).optional(),
  reviewText: z.string().optional(),
  textWhen: z.array(TextWhenSchema).optional(),
  complexValidation: ComplexValidationSchema.optional(),
  element: z.string().optional(),
  triggers: z.array(triggerSchema).optional(),
});

export const FormSectionArraySchema = z.object({
  linkId: z.array(z.string()),
  title: z.string(),
  items: z.array(FormFieldItemRecordSchema),
  logicalItems: FormFieldLogicalItemRecordSchema.optional(),
  hiddenFields: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  // Group-level properties
  enableWhen: z.array(GroupLevelEnableWhenSchema).optional(),
  enableBehavior: z.enum(['all', 'any']).optional(),
  reviewText: z.string().optional(),
  textWhen: z.array(TextWhenSchema).optional(),
  complexValidation: ComplexValidationSchema.optional(),
  element: z.string().optional(),
  triggers: z.array(triggerSchema).optional(),
});

export type FormFieldSection = z.infer<typeof FormSectionSimpleSchema> | z.infer<typeof FormSectionArraySchema>;

const createDataTypeExtension = (dataType: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
  valueString: dataType,
});

const createDisabledDisplayExtension = (display: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display',
  valueString: display,
});

const createFillFromWhenDisabledExtension = (
  sourceLinkId: string
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/fill-from-when-disabled',
  valueString: sourceLinkId,
});

const createFilterWhenExtension = (trigger: FormFieldTrigger): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when',
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-question',
      valueString: trigger.targetQuestionLinkId,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-operator',
      valueString: trigger.operator,
    },
    ...(trigger.answerBoolean !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
            valueBoolean: trigger.answerBoolean,
          },
        ]
      : []),
    ...(trigger.answerString !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/filter-when-answer',
            valueString: trigger.answerString,
          },
        ]
      : []),
  ],
});

const createRequireWhenExtension = (
  trigger: FormFieldTrigger
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
      valueString: trigger.targetQuestionLinkId,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
      valueString: trigger.operator,
    },
    ...(trigger.answerBoolean !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
            valueBoolean: trigger.answerBoolean,
          },
        ]
      : []),
    ...(trigger.answerString !== undefined
      ? [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
            valueString: trigger.answerString,
          },
        ]
      : []),
  ],
});

const createAnswerLoadingOptionsExtension = (
  dataSource: any
): NonNullable<QuestionnaireItem['extension']>[number] | undefined => {
  const { answerSource } = dataSource;
  if (!answerSource) return undefined;

  return {
    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-loading-options',
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/strategy',
        valueString: 'dynamic',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/source',
        valueExpression: {
          language: 'application/x-fhir-query',
          expression: `${answerSource.resourceType}?${answerSource.query}`,
        },
      },
    ],
  };
};

const createInputWidthExtension = (width: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-width',
  valueString: width,
});

const createAutocompleteExtension = (autocomplete: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete',
  valueString: autocomplete,
});

const createPreferredElementExtension = (element: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/preferred-element',
  valueString: element,
});

const createPermissibleValueExtension = (
  value: boolean | string
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/permissible-value',
  ...(typeof value === 'boolean' ? { valueBoolean: value } : { valueString: value }),
});

const createPlaceholderExtension = (placeholder: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder',
  valueString: placeholder,
});

const createInfoTextSecondaryExtension = (infoText: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary',
  valueString: infoText,
});

const createAttachmentTextExtension = (
  attachmentText: string
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
  valueString: attachmentText,
});

const createDocumentTypeExtension = (documentType: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
  valueString: documentType,
});

const createReviewTextExtension = (reviewText: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/review-text',
  valueString: reviewText,
});

const createTextWhenExtension = (
  textWhen: z.infer<typeof TextWhenSchema>
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when',
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question',
      valueString: textWhen.question,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator',
      valueString: textWhen.operator,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer',
      valueString: textWhen.answer,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text',
      valueString: textWhen.substituteText,
    },
  ],
});

const createComplexValidationExtension = (
  validation: z.infer<typeof ComplexValidationSchema>
): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation',
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-type',
      valueString: validation.type,
    },
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerWhen',
      extension: [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerQuestion',
          valueString: validation.triggerWhen.question,
        },
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerOperator',
          valueString: validation.triggerWhen.operator,
        },
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/complex-validation-triggerAnswer',
          valueString: validation.triggerWhen.answer,
        },
      ],
    },
  ],
});

const createEnableWhen = (trigger: FormFieldTrigger): QuestionnaireItem['enableWhen'] => {
  const enableWhen: any = {
    question: trigger.targetQuestionLinkId,
    operator: trigger.operator,
  };

  if (trigger.answerBoolean !== undefined) {
    enableWhen.answerBoolean = trigger.answerBoolean;
  } else if (trigger.answerString !== undefined) {
    enableWhen.answerString = trigger.answerString;
  } else if (trigger.answerDateTime !== undefined) {
    enableWhen.answerDateTime = trigger.answerDateTime;
  }

  return enableWhen;
};

const createGroupEnableWhen = (enableWhen: z.infer<typeof GroupLevelEnableWhenSchema>): any => {
  const result: any = {
    question: enableWhen.question,
    operator: enableWhen.operator,
  };

  if (enableWhen.answerBoolean !== undefined) {
    result.answerBoolean = enableWhen.answerBoolean;
  } else if (enableWhen.answerString !== undefined) {
    result.answerString = enableWhen.answerString;
  } else if (enableWhen.answerDateTime !== undefined) {
    result.answerDateTime = enableWhen.answerDateTime;
  }

  return result;
};

const convertDisplayFieldToQuestionnaireItem = (field: FormFieldsDisplayItem): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: 'display',
    text: field.text,
  };

  const extensions: any[] = [];

  if (field.element) {
    extensions.push(createPreferredElementExtension(field.element));
  }

  // Add textWhen extensions
  if (field.textWhen && field.textWhen.length > 0) {
    field.textWhen.forEach((tw) => {
      extensions.push(createTextWhenExtension(tw));
    });
  }

  // Add enableWhen from triggers
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i) => createEnableWhen(i)!);
    }

    // Add enableBehavior if specified
    if (field.enableBehavior && item.enableWhen && item.enableWhen.length > 1) {
      item.enableBehavior = field.enableBehavior;
    }
  }

  if (extensions.length > 0) {
    item.extension = extensions;
  }

  return item;
};

const convertAttachmentFieldToQuestionnaireItem = (
  field: FormFieldsAttachmentItem,
  isRequired: boolean
): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: 'attachment',
    text: field.label,
    required: isRequired,
  };

  const extensions: any[] = [];

  if (field.attachmentText) {
    extensions.push(createAttachmentTextExtension(field.attachmentText));
  }

  if (field.dataType) {
    extensions.push(createDataTypeExtension(field.dataType));
  }

  if (field.documentType) {
    extensions.push(createDocumentTypeExtension(field.documentType));
  }

  if (extensions.length > 0) {
    item.extension = extensions;
  }

  return item;
};

const convertGroupFieldToQuestionnaireItem = (
  field: FormFieldsGroupItem,
  requiredFields?: string[]
): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: 'group',
    item: [],
  };

  if (field.text) {
    item.text = field.text;
  }

  // Convert nested items
  for (const [, nestedField] of Object.entries(field.items)) {
    let questionnaireItem: QuestionnaireItem;
    const typedField = nestedField as any;
    if (typedField.type === 'display') {
      questionnaireItem = convertDisplayFieldToQuestionnaireItem(typedField as FormFieldsDisplayItem);
    } else if (typedField.type === 'attachment') {
      const isRequired = requiredFields?.includes(typedField.key) ?? false;
      questionnaireItem = convertAttachmentFieldToQuestionnaireItem(typedField as FormFieldsAttachmentItem, isRequired);
    } else if (typedField.type === 'group') {
      questionnaireItem = convertGroupFieldToQuestionnaireItem(typedField as FormFieldsGroupItem, requiredFields);
    } else {
      const isRequired = requiredFields?.includes(typedField.key) ?? false;
      questionnaireItem = convertFormFieldToQuestionnaireItem(typedField as FormFieldsItem, isRequired);
    }
    item.item!.push(questionnaireItem);
  }

  // Add enableWhen from triggers
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t: any) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i: any) => createEnableWhen(i)!);
    }

    const filterTriggers = field.triggers.filter((t: any) => t.effect.includes('filter'));
    if (filterTriggers.length > 0) {
      if (!item.extension) item.extension = [];
      filterTriggers.forEach((trigger: any) => {
        item.extension!.push(createFilterWhenExtension(trigger));
      });
    }

    // Add enableBehavior if specified
    if (field.enableBehavior && item.enableWhen && item.enableWhen.length > 1) {
      item.enableBehavior = field.enableBehavior;
    }
  }

  // Add any custom extensions
  if (field.extension) {
    if (!item.extension) item.extension = [];
    item.extension.push(...field.extension);
  }

  return item;
};

const convertFormFieldToQuestionnaireItem = (
  anyKindOfField: FormFieldsItem,
  isRequired: boolean
): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: anyKindOfField.key,
    type: anyKindOfField.type === 'reference' ? 'choice' : (anyKindOfField.type as any),
  };

  if (item.type === 'attachment') {
    return convertAttachmentFieldToQuestionnaireItem(anyKindOfField as FormFieldsAttachmentItem, isRequired);
  }

  if (item.type === 'display') {
    return convertDisplayFieldToQuestionnaireItem(anyKindOfField as FormFieldsDisplayItem);
  }

  if (item.type === 'group') {
    return convertGroupFieldToQuestionnaireItem(anyKindOfField as FormFieldsGroupItem);
  }

  const field: FormFieldsInputItem = anyKindOfField as FormFieldsInputItem;

  // Add text if label is provided
  if ((field as FormFieldsInputItem).label) {
    item.text = field.label;
  }

  // Add required flag
  item.required = isRequired;

  // Add answer options for choice types
  if (field.type === 'choice' && field.options) {
    item.answerOption = field.options.map((opt) => ({ valueString: opt.value }));
  }

  // Handle reference type for dynamic data source
  if (field.type === 'reference' && field.dataSource) {
    const answerLoadingExt = createAnswerLoadingOptionsExtension(field.dataSource);
    if (answerLoadingExt) {
      item.extension = [answerLoadingExt];
    }
  }

  // Add extensions
  const extensions: any[] = item.extension ? [...item.extension] : [];

  if (field.dataType) {
    extensions.push(createDataTypeExtension(field.dataType));
  }

  if (field.disabledDisplay && field.disabledDisplay !== 'disabled') {
    extensions.push(createDisabledDisplayExtension(field.disabledDisplay));
  }

  if (field.dynamicPopulation) {
    extensions.push(createFillFromWhenDisabledExtension(field.dynamicPopulation.sourceLinkId));
    if (!field.disabledDisplay) {
      extensions.push(createDisabledDisplayExtension('protected'));
    }
  }

  if (field.inputWidth) {
    extensions.push(createInputWidthExtension(field.inputWidth));
  }

  if (field.placeholder) {
    extensions.push(createPlaceholderExtension(field.placeholder));
  }

  if (field.autocomplete) {
    extensions.push(createAutocompleteExtension(field.autocomplete));
  }

  if (field.permissibleValue !== undefined) {
    extensions.push(createPermissibleValueExtension(field.permissibleValue));
  }

  if (field.infoTextSecondary) {
    extensions.push(createInfoTextSecondaryExtension(field.infoTextSecondary));
  }

  if (field.element) {
    extensions.push(createPreferredElementExtension(field.element));
  }

  // Add enableWhen from triggers
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i) => createEnableWhen(i)!);
    }

    // Add require-when extension
    const requireTriggers = field.triggers.filter((t) => t.effect.includes('require'));
    if (requireTriggers.length > 0) {
      requireTriggers.forEach((trigger) => {
        extensions.push(createRequireWhenExtension(trigger));
      });
    }

    // Add filter-when extension
    const filterTriggers = field.triggers.filter((t) => t.effect.includes('filter'));
    if (filterTriggers.length > 0) {
      filterTriggers.forEach((trigger) => {
        extensions.push(createFilterWhenExtension(trigger));
      });
    }

    // Add enableBehavior if specified
    if (field.enableBehavior && item.enableWhen && item.enableWhen.length > 1) {
      item.enableBehavior = field.enableBehavior;
    }
  }

  if (extensions.length > 0) {
    item.extension = extensions;
  }

  return item;
};

const convertLogicalItemToQuestionnaireItem = (field: FormFieldsLogicalItem): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: field.type,
    required: field.required ?? true,
    readOnly: true,
  };

  // Add answer options for choice types
  if (field.type === 'choice' && field.options) {
    item.answerOption = field.options.map((opt) => ({ valueString: opt.value }));
  }

  // Add initial value if provided
  if (field.initialValue !== undefined) {
    if (field.type === 'boolean') {
      item.initial = [{ valueBoolean: field.initialValue as boolean }];
    } else if (field.type === 'string' || field.type === 'date') {
      item.initial = [{ valueString: field.initialValue as string }];
    }
  }

  // Add extensions for logical fields
  const extensions: any[] = [];

  // Add dataType extension if specified
  if (field.dataType) {
    extensions.push(createDataTypeExtension(field.dataType));
  }

  // Add disabled-display extension for hidden logical fields
  extensions.push(createDisabledDisplayExtension('hidden'));

  if (extensions.length > 0) {
    item.extension = extensions;
  }

  return item;
};

export const QuestionnaireBaseSchema = z.object({
  resourceType: z.literal('Questionnaire'),
  url: z.string(),
  version: z.string(),
  name: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'active', 'retired', 'unknown']),
});
export type QuestionnaireBase = z.infer<typeof QuestionnaireBaseSchema>;

export const QuestionnaireConfigSchema = z.object({
  questionnaireBase: QuestionnaireBaseSchema,
  hiddenFormSections: z.array(z.string()),
  FormFields: z.record(z.string(), z.union([FormSectionSimpleSchema, FormSectionArraySchema])),
});
type QuestionnaireConfigType = z.infer<typeof QuestionnaireConfigSchema>;

const applyGroupLevelProperties = (
  groupItem: QuestionnaireItem,
  section: z.infer<typeof FormSectionSimpleSchema> | z.infer<typeof FormSectionArraySchema>
): void => {
  // Convert triggers with 'enable' effect to enableWhen
  const enableWhens: any[] = [];

  if (section.enableWhen && section.enableWhen.length > 0) {
    enableWhens.push(...section.enableWhen.map((ew) => createGroupEnableWhen(ew)));
  }

  if (section.triggers && section.triggers.length > 0) {
    const enableTriggers = section.triggers.filter((t) => t.effect.includes('enable'));
    enableTriggers.forEach((trigger) => {
      const enableWhen: any = {
        question: trigger.targetQuestionLinkId,
        operator: trigger.operator,
      };
      if (trigger.answerBoolean !== undefined) {
        enableWhen.answerBoolean = trigger.answerBoolean;
      }
      if (trigger.answerString !== undefined) {
        enableWhen.answerString = trigger.answerString;
      }
      enableWhens.push(enableWhen);
    });
  }

  if (enableWhens.length > 0) {
    groupItem.enableWhen = enableWhens;
  }

  // Apply group-level enableBehavior
  if (section.enableBehavior && groupItem.enableWhen && groupItem.enableWhen.length > 1) {
    groupItem.enableBehavior = section.enableBehavior;
  }

  // Apply group-level extensions
  const groupExtensions: any[] = [];
  if (section.reviewText) {
    groupExtensions.push(createReviewTextExtension(section.reviewText));
  }

  if (section.complexValidation) {
    groupExtensions.push(createComplexValidationExtension(section.complexValidation));
  }

  if (section.textWhen && section.textWhen.length > 0) {
    section.textWhen.forEach((tw) => {
      groupExtensions.push(createTextWhenExtension(tw));
    });
  }

  if (section.element) {
    groupExtensions.push(createPreferredElementExtension(section.element));
  }

  if (groupExtensions.length > 0) {
    groupItem.extension = groupExtensions;
  }
};

export const createQuestionnaireItemFromConfig = (config: QuestionnaireConfigType): Questionnaire['item'] => {
  const questionnaireItems: QuestionnaireItem[] = [];

  // Define the order of sections as they appear in the JSON
  const sectionOrder = Object.entries(config.FormFields).map(([key]) => key) as ReadonlyArray<string>;

  for (const sectionKey of sectionOrder) {
    const section = config.FormFields[sectionKey];
    if (!section) continue;

    // Handle array-based sections (like insurance)
    if (Array.isArray(section.linkId)) {
      section.linkId.forEach((linkId, index) => {
        const items = Array.isArray(section.items) ? section.items[index] : section.items;
        const groupItem: QuestionnaireItem = {
          linkId,
          type: 'group',
          text: section.title,
          repeats: true,
          item: [],
        };

        // Convert each field to a questionnaire item first
        for (const [, field] of Object.entries(items)) {
          let questionnaireItem: QuestionnaireItem;
          const typedField = field as any;
          if (typedField.type === 'display') {
            questionnaireItem = convertDisplayFieldToQuestionnaireItem(typedField as FormFieldsDisplayItem);
          } else if (typedField.type === 'attachment') {
            const isRequired = section.requiredFields?.includes(typedField.key) ?? false;
            questionnaireItem = convertAttachmentFieldToQuestionnaireItem(
              typedField as FormFieldsAttachmentItem,
              isRequired
            );
          } else if (typedField.type === 'group') {
            questionnaireItem = convertGroupFieldToQuestionnaireItem(
              typedField as FormFieldsGroupItem,
              section.requiredFields
            );
          } else {
            const isRequired = section.requiredFields?.includes(typedField.key) ?? false;
            questionnaireItem = convertFormFieldToQuestionnaireItem(typedField as FormFieldsItem, isRequired);
          }
          groupItem.item!.push(questionnaireItem);
        }

        // Add logical items after regular fields (only for the first item in array-based sections)
        if (section.logicalItems && index === 0) {
          for (const [, logicalField] of Object.entries(section.logicalItems)) {
            const logicalItem = convertLogicalItemToQuestionnaireItem(logicalField);
            groupItem.item!.push(logicalItem);
          }
        }

        // Apply group-level properties
        applyGroupLevelProperties(groupItem, section);

        questionnaireItems.push(groupItem);
      });
    } else {
      // Handle simple sections
      const groupItem: QuestionnaireItem = {
        linkId: section.linkId,
        type: 'group',
        text: section.title,
        item: [],
      };

      // Convert each field to a questionnaire item first
      for (const [, field] of Object.entries(section.items)) {
        let questionnaireItem: QuestionnaireItem;
        const typedField = field as any;
        if (typedField.type === 'display') {
          questionnaireItem = convertDisplayFieldToQuestionnaireItem(typedField as FormFieldsDisplayItem);
        } else if (typedField.type === 'attachment') {
          const isRequired = section.requiredFields?.includes(typedField.key) ?? false;
          questionnaireItem = convertAttachmentFieldToQuestionnaireItem(
            typedField as FormFieldsAttachmentItem,
            isRequired
          );
        } else if (typedField.type === 'group') {
          questionnaireItem = convertGroupFieldToQuestionnaireItem(
            typedField as FormFieldsGroupItem,
            section.requiredFields
          );
        } else {
          const isRequired = section.requiredFields?.includes(typedField.key) ?? false;
          questionnaireItem = convertFormFieldToQuestionnaireItem(typedField as FormFieldsItem, isRequired);
        }
        groupItem.item!.push(questionnaireItem);
      }

      // Add logical items after regular fields
      if (section.logicalItems) {
        for (const [, logicalField] of Object.entries(section.logicalItems)) {
          const logicalItem = convertLogicalItemToQuestionnaireItem(logicalField);
          groupItem.item!.push(logicalItem);
        }
      }

      // Apply group-level properties
      applyGroupLevelProperties(groupItem, section);

      questionnaireItems.push(groupItem);
    }
  }

  return questionnaireItems;
};

export const createQuestionnaireFromConfig = (config: QuestionnaireConfigType): Questionnaire => {
  return {
    ...config.questionnaireBase,
    item: createQuestionnaireItemFromConfig(config),
  };
};

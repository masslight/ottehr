import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import z from 'zod';
import { AnswerOptionSourceSchema, QuestionnaireDataTypeSchema } from '../types/data/paperwork/paperwork.types';

const triggerEffectSchema = z.enum(['enable', 'require']);
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

const FormFieldsDisplayFieldSchema = z.object({
  key: z.string(),
  type: z.literal('display'),
  text: z.string(),
  element: z.enum(['h3', 'p']).optional(),
  triggers: z.array(triggerSchema).optional(),
  enableBehavior: z.enum(['all', 'any']).default('any').optional(),
});

const FormFieldsValueTypeSchema = z
  .object({
    key: z.string(),
    type: z.enum(['string', 'date', 'choice', 'boolean', 'reference']),
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
  })
  .refine(
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
  )
  .refine(
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

export type FormFieldsItem = z.infer<typeof FormFieldsValueTypeSchema>;
export type FormFieldsDisplayItem = z.infer<typeof FormFieldsDisplayFieldSchema>;
export type FormFieldsLogicalItem = z.infer<typeof FormFieldsLogicalFieldSchema>;

export const FormFieldItemRecordSchema = z.record(z.union([FormFieldsValueTypeSchema, FormFieldsDisplayFieldSchema]));
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

const TextWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answer: z.string(),
  substituteText: z.string(),
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

const convertFormFieldToQuestionnaireItem = (field: FormFieldsItem, isRequired: boolean): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.key,
    type: field.type === 'reference' ? 'choice' : (field.type as any),
  };

  // Add text if label is provided
  if (field.label) {
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
    item.answerOption = [{ valueString: '09' }]; // Placeholder, will be replaced dynamically
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

  if (field.autocomplete) {
    extensions.push(createAutocompleteExtension(field.autocomplete));
  }

  if (field.permissibleValue !== undefined) {
    extensions.push(createPermissibleValueExtension(field.permissibleValue));
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
    required: field.type === 'boolean' || field.type === 'choice',
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

  // Add disabled-display extension for hidden logical fields
  const extensions: any[] = [];
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
  // Apply group-level enableWhen
  if (section.enableWhen && section.enableWhen.length > 0) {
    groupItem.enableWhen = section.enableWhen.map((ew) => createGroupEnableWhen(ew));
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

  if (section.textWhen && section.textWhen.length > 0) {
    section.textWhen.forEach((tw) => {
      groupExtensions.push(createTextWhenExtension(tw));
    });
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

        // Add logical items first (only for the first item in array-based sections)
        if (section.logicalItems && index === 0) {
          for (const [, logicalField] of Object.entries(section.logicalItems)) {
            const logicalItem = convertLogicalItemToQuestionnaireItem(logicalField);
            groupItem.item!.push(logicalItem);
          }
        }

        // Convert each field to a questionnaire item
        for (const [, field] of Object.entries(items)) {
          let questionnaireItem: QuestionnaireItem;
          if (field.type === 'display') {
            questionnaireItem = convertDisplayFieldToQuestionnaireItem(field as FormFieldsDisplayItem);
          } else {
            const isRequired = section.requiredFields?.includes(field.key) ?? false;
            questionnaireItem = convertFormFieldToQuestionnaireItem(field as FormFieldsItem, isRequired);
          }
          groupItem.item!.push(questionnaireItem);
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

      // Add logical items first
      if (section.logicalItems) {
        for (const [, logicalField] of Object.entries(section.logicalItems)) {
          const logicalItem = convertLogicalItemToQuestionnaireItem(logicalField);
          groupItem.item!.push(logicalItem);
        }
      }

      // Convert each field to a questionnaire item
      for (const [, field] of Object.entries(section.items)) {
        let questionnaireItem: QuestionnaireItem;
        if (field.type === 'display') {
          questionnaireItem = convertDisplayFieldToQuestionnaireItem(field as FormFieldsDisplayItem);
        } else {
          const isRequired = section.requiredFields?.includes(field.key) ?? false;
          questionnaireItem = convertFormFieldToQuestionnaireItem(field as FormFieldsItem, isRequired);
        }
        groupItem.item!.push(questionnaireItem);
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

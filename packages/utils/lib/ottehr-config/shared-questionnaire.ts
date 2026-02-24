import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import {
  ComplexValidationSchema,
  type FormFieldsAttachmentItem,
  type FormFieldsDisplayItem,
  type FormFieldsGroupItem,
  type FormFieldsInputItem,
  type FormFieldsItem,
  type FormFieldsLogicalItem,
  type FormFieldTrigger,
  FormSectionArraySchema,
  FormSectionSimpleSchema,
  type QuestionnaireConfigType,
} from 'ottehr-types';
import z from 'zod';
import { VALUE_SETS as formValueSets } from './value-sets';

// Re-export from ottehr-types for backwards compatibility
export {
  FormFieldItemRecordSchema,
  FormFieldLogicalItemRecordSchema,
  FormFieldTriggerSchema,
  FormSectionArraySchema,
  FormSectionSimpleSchema,
  QuestionnaireBaseSchema,
  QuestionnaireConfigSchema,
} from 'ottehr-types';
export type {
  FormFieldItemRecord,
  FormFieldLogicalItemRecord,
  FormFieldsAttachmentItem,
  FormFieldsDisplayItem,
  FormFieldsGroupItem,
  FormFieldsInputItem,
  FormFieldsItem,
  FormFieldsLogicalItem,
  FormFieldSection,
  FormFieldTrigger,
  QuestionnaireBase,
  FormFieldOption,
  QuestionnaireConfigType,
} from 'ottehr-types';

export const INSURANCE_PAY_OPTION = formValueSets.patientPaymentPageOptions[0].value; // 'I have insurance'
export const SELF_PAY_OPTION = formValueSets.patientPaymentPageOptions[1].value; // 'I will pay without insurance'
export const OCC_MED_SELF_PAY_OPTION = formValueSets.patientOccMedPaymentPageOptions[0].value; // 'Self'
export const OCC_MED_EMPLOYER_PAY_OPTION = formValueSets.patientOccMedPaymentPageOptions[1].value; // 'Employer'

export const ALLERGIES_YES_OPTION = formValueSets.allergiesYesNoOptions[1].value; // some flavor of 'yes'
export const SURGICAL_HISTORY_YES_OPTION = formValueSets.surgicalHistoryYesNoOptions[1].value; // 'Patient has surgical history'
export const HAS_ATTORNEY_OPTION = formValueSets.attorneyOptions[0].value; // 'I have an attorney'
export const DOES_NOT_HAVE_ATTORNEY_OPTION = formValueSets.attorneyOptions[1].value; // 'I do not have an attorney'

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

const createAcceptsMultipleAnswersExtension = (): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/accepts-multiple-answers',
  valueBoolean: true,
});

const createCustomLinkIdExtension = (customLinkId: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/custom-link-id',
  valueString: customLinkId,
});

const createCategoryTagExtension = (categoryTag: string): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/category-tag',
  valueString: categoryTag,
});

const createAlwaysFilterExtension = (): NonNullable<QuestionnaireItem['extension']>[number] => ({
  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/always-filter',
  valueBoolean: true,
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
  textWhen: Omit<FormFieldTrigger, 'effect'>
): NonNullable<QuestionnaireItem['extension']>[number] => {
  const answerExtension: any = {
    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-answer',
  };

  if (textWhen.answerString !== undefined) {
    answerExtension.valueString = textWhen.answerString;
  } else if (textWhen.answerBoolean !== undefined) {
    answerExtension.valueBoolean = textWhen.answerBoolean;
  } else if (textWhen.answerDateTime !== undefined) {
    answerExtension.valueDateTime = textWhen.answerDateTime;
  }

  return {
    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when',
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-question',
        valueString: textWhen.targetQuestionLinkId,
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-operator',
        valueString: textWhen.operator,
      },
      answerExtension,
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-when-substitute-text',
        valueString: textWhen.substituteText,
      },
    ],
  };
};

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

  if (field.dataType) {
    extensions.push(createDataTypeExtension(field.dataType));
  }

  // Add enableWhen and textWhen from triggers
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i) => createEnableWhen(i)!);
    }

    // Add enableBehavior if specified
    if (field.enableBehavior && item.enableWhen && item.enableWhen.length > 1) {
      item.enableBehavior = field.enableBehavior;
    }
    const textWhenTriggers = field.triggers.filter((t) => t.effect.includes('sub-text'));
    if (textWhenTriggers.length > 0) {
      textWhenTriggers.forEach((trigger) => {
        extensions.push(createTextWhenExtension(trigger));
      });
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

  // Handle triggers for attachment fields
  if (field.triggers && field.triggers.length > 0) {
    const enableTriggers = field.triggers.filter((t) => t.effect.includes('enable'));
    if (enableTriggers.length > 0) {
      item.enableWhen = enableTriggers.flatMap((i) => createEnableWhen(i)!);
      if (enableTriggers.length > 1 && field.enableBehavior) {
        item.enableBehavior = field.enableBehavior;
      }
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

  if (field.required !== undefined) {
    item.required = field.required;
  }

  // Add group-level extensions
  const groupExtensions: any[] = [...(field.extension || [])];

  if (field.groupType) {
    groupExtensions.push({
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/group-type',
      valueString: field.groupType,
    });
  }

  if (field.customLinkId) {
    groupExtensions.push(createCustomLinkIdExtension(field.customLinkId));
  }

  if (field.acceptsMultipleAnswers) {
    groupExtensions.push(createAcceptsMultipleAnswersExtension());
  }

  if (field.categoryTag) {
    groupExtensions.push(createCategoryTagExtension(field.categoryTag));
  }

  // Add require-when extension for group
  const requireTriggers = field.triggers?.filter((t) => t.effect.includes('require')) || [];
  if (requireTriggers.length > 0) {
    requireTriggers.forEach((trigger) => {
      groupExtensions.push(createRequireWhenExtension(trigger));
    });
  }

  // Add filter-when extension for group
  const filterTriggers = field.triggers?.filter((t) => t.effect.includes('filter')) || [];
  if (filterTriggers.length > 0) {
    filterTriggers.forEach((trigger) => {
      groupExtensions.push(createFilterWhenExtension(trigger));
    });
  }

  if (groupExtensions.length > 0) {
    item.extension = groupExtensions;
  }

  // Add enableWhen for group-level enable triggers
  const groupEnableTriggers = field.triggers?.filter((t) => t.effect.includes('enable')) || [];
  if (groupEnableTriggers.length > 0) {
    item.enableWhen = groupEnableTriggers.flatMap((trigger) => createEnableWhen(trigger)!);
    if (groupEnableTriggers.length > 1 && field.enableBehavior) {
      item.enableBehavior = field.enableBehavior;
    }
  }

  // Convert nested items
  // Use the group's own requiredFields if available, otherwise use parent's
  const effectiveRequiredFields = field.requiredFields ?? requiredFields;
  for (const [, nestedField] of Object.entries(field.items)) {
    let questionnaireItem: QuestionnaireItem;
    const typedField = nestedField as any;
    if (typedField.type === 'display') {
      questionnaireItem = convertDisplayFieldToQuestionnaireItem(typedField as FormFieldsDisplayItem);
    } else if (typedField.type === 'attachment') {
      const isRequired = effectiveRequiredFields?.includes(typedField.key) ?? false;
      questionnaireItem = convertAttachmentFieldToQuestionnaireItem(typedField as FormFieldsAttachmentItem, isRequired);
    } else if (typedField.type === 'group') {
      questionnaireItem = convertGroupFieldToQuestionnaireItem(
        typedField as FormFieldsGroupItem,
        effectiveRequiredFields
      );
    } else {
      const isRequired = effectiveRequiredFields?.includes(typedField.key) ?? false;
      questionnaireItem = convertFormFieldToQuestionnaireItem(typedField as FormFieldsItem, isRequired);
    }
    item.item!.push(questionnaireItem);
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

  // Add answer options for choice and open-choice types
  if ((field.type === 'choice' || field.type === 'open-choice') && field.options) {
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

  if (field.disabledDisplay) {
    const disabledDisplay = field.disabledDisplay === 'disabled' ? 'protected' : field.disabledDisplay;
    extensions.push(createDisabledDisplayExtension(disabledDisplay));
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

  if (field.customLinkId) {
    extensions.push(createCustomLinkIdExtension(field.customLinkId));
  }

  if (field.acceptsMultipleAnswers) {
    extensions.push(createAcceptsMultipleAnswersExtension());
  }

  if (field.categoryTag) {
    extensions.push(createCategoryTagExtension(field.categoryTag));
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

  // Add preferred-element extension after require-when but before textWhen and filter-when
  if (field.element) {
    extensions.push(createPreferredElementExtension(field.element));
  }

  // Add textWhen form triggers
  if (field.triggers && field.triggers.length > 0) {
    const textWhenTriggers = field.triggers.filter((t) => t.effect.includes('sub-text'));
    textWhenTriggers.forEach((tw) => {
      extensions.push(createTextWhenExtension(tw));
    });
  }

  // Add alwaysFilter extension
  if (field.alwaysFilter) {
    extensions.push(createAlwaysFilterExtension());
  }

  // Add filter-when extension from triggers
  if (field.triggers && field.triggers.length > 0) {
    const filterTriggers = field.triggers.filter((t) => t.effect.includes('filter'));
    if (filterTriggers.length > 0) {
      filterTriggers.forEach((trigger) => {
        extensions.push(createFilterWhenExtension(trigger));
      });
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

  // Add answer options for choice and open-choice types
  if ((field.type === 'choice' || field.type === 'open-choice') && field.options) {
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

// QuestionnaireBaseSchema and QuestionnaireConfigSchema are now imported and re-exported from ottehr-types

const applyGroupLevelProperties = (
  groupItem: QuestionnaireItem,
  section: z.infer<typeof FormSectionSimpleSchema> | z.infer<typeof FormSectionArraySchema>
): void => {
  // Convert triggers with 'enable' effect to enableWhen
  const enableWhens: any[] = [];

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

  const textWhenTriggers = (section.triggers ?? []).filter((t) => t.effect.includes('sub-text'));
  if (textWhenTriggers.length > 0) {
    textWhenTriggers.forEach((trigger) => {
      groupExtensions.push(createTextWhenExtension(trigger));
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
        // Skip hidden form sections
        if (config.hiddenFormSections?.includes(linkId)) return;
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
          // Skip hidden fields
          if (section.hiddenFields?.includes(typedField.key)) continue;
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
      // Skip hidden form sections
      if (config.hiddenFormSections?.includes(section.linkId)) continue;

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
        // Skip hidden fields
        if (section.hiddenFields?.includes(typedField.key)) continue;
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

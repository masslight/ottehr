import { z } from 'zod';
import { CodeableConceptSchema } from '../../fhir';

// Schema for an 8 character hexadecimal hash string
const HexHashSchema = z.string().regex(/^[a-f0-9]{8}$/, 'Must be a valid 8-character hexadecimal hash string');

// Schema for checkbox component
const ExamCardCheckboxComponentSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  type: z.literal('checkbox'),
  code: CodeableConceptSchema.optional(),
  bodySite: CodeableConceptSchema.optional(),
});

// Schema for dropdown option component
const ExamCardDropdownOptionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  type: z.literal('option'),
  code: CodeableConceptSchema.optional(),
  bodySite: CodeableConceptSchema.optional(),
});

// Schema for dropdown component
const ExamCardDropdownComponentSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  type: z.literal('dropdown'),
  components: z.record(z.string(), ExamCardDropdownOptionSchema),
});

// Schema for text component
const ExamCardTextComponentSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.literal('text'),
  code: CodeableConceptSchema.optional(),
});

// Schema for column component (recursive)
const ExamCardColumnComponentSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string().min(1, 'Label is required'),
    type: z.literal('column'),
    components: z.record(z.string(), ExamCardComponentSchema),
  })
);

// Schema for form field option
const ExamCardFormFieldOptionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
});

// Schema for form field
const ExamCardFormFieldSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.union([z.literal('radio'), z.literal('dropdown'), z.literal('text')]),
  enabledWhen: z
    .object({
      field: z.string().min(1, 'Field is required'),
      value: z.string().min(1, 'Value is required'),
    })
    .optional(),
  options: z.record(z.string(), ExamCardFormFieldOptionSchema).optional(),
});

// Schema for form element
const ExamCardFormElementSchema = z.object({
  defaultValue: z.boolean(),
  type: z.literal('form-element'),
  code: CodeableConceptSchema.optional(),
  bodySite: CodeableConceptSchema.optional(),
});

// Schema for form component
const ExamCardFormComponentSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.literal('form'),
  components: z.record(z.string(), ExamCardFormElementSchema),
  fields: z.record(z.string(), ExamCardFormFieldSchema),
});

// Schema for multi-select option
const ExamCardMultiSelectOptionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  description: z.string().optional(),
  code: CodeableConceptSchema.optional(),
  bodySite: CodeableConceptSchema.optional(),
});

// Schema for multi-select component
const ExamCardMultiSelectComponentSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.literal('multi-select'),
  options: z.record(z.string(), ExamCardMultiSelectOptionSchema),
});

// Union schema for non-text components
const ExamCardNonTextComponentSchema = z.union([
  ExamCardCheckboxComponentSchema,
  ExamCardDropdownComponentSchema,
  ExamCardColumnComponentSchema,
  ExamCardFormComponentSchema,
  ExamCardMultiSelectComponentSchema,
]);

// Union schema for all component types
const ExamCardComponentSchema = z.union([ExamCardNonTextComponentSchema, ExamCardTextComponentSchema]);

// Type guard functions for better type narrowing
export function isDropdownComponent(component: ExamCardComponent): component is ExamCardDropdownComponent {
  return component.type === 'dropdown';
}

export function isMultiSelectComponent(component: ExamCardComponent): component is ExamCardMultiSelectComponent {
  return component.type === 'multi-select';
}

export type ExamCardComponent = z.infer<typeof ExamCardComponentSchema>;

// Create discriminated union types for better type narrowing
export type ExamCardDropdownComponent = z.infer<typeof ExamCardDropdownComponentSchema>;
export type ExamCardMultiSelectComponent = z.infer<typeof ExamCardMultiSelectComponentSchema>;
export type ExamCardFormComponent = z.infer<typeof ExamCardFormComponentSchema>;
export type ExamCardCheckboxComponent = z.infer<typeof ExamCardCheckboxComponentSchema>;
export type ExamCardTextComponent = z.infer<typeof ExamCardTextComponentSchema>;

// Schema for exam card
const ExamCardSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  components: z.object({
    normal: z.record(z.string(), ExamCardNonTextComponentSchema),
    abnormal: z.record(z.string(), ExamCardNonTextComponentSchema),
    comment: z.record(z.string(), ExamCardTextComponentSchema),
  }),
});

// Schema for exam item config
const ExamItemConfigSchema = z.record(z.string(), ExamCardSchema);

export type ExamItemConfig = z.infer<typeof ExamItemConfigSchema>;

// Schema for exam type
const ExamTypeInstanceSchema = z.record(
  z.string(),
  z.object({
    version: HexHashSchema,
    components: ExamItemConfigSchema,
  })
);

const ExamConfigTypeSchema = z.object({
  telemed: ExamTypeInstanceSchema,
  inPerson: ExamTypeInstanceSchema,
});

export type ExamSchema = z.infer<typeof ExamConfigTypeSchema>;

export const validateExamConfig = (config: unknown): ExamSchema => {
  return ExamConfigTypeSchema.parse(config);
};

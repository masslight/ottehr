import z from 'zod';

/**
 * Examination Configuration Types
 *
 * These types define the contract for exam card configurations,
 * supporting telemed and in-person examination workflows.
 */

/**
 * FHIR CodeableConcept - simplified for config contracts
 */
export interface ExamCodeableConcept {
  coding?: Array<{
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
  }>;
  text?: string;
}

const ExamCodingSchema = z.object({
  system: z.string().optional(),
  version: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
  userSelected: z.boolean().optional(),
});

export const ExamCodeableConceptSchema: z.ZodType<ExamCodeableConcept, z.ZodTypeDef, unknown> = z.object({
  coding: z.array(ExamCodingSchema).optional(),
  text: z.string().optional(),
});

/**
 * Base properties shared by exam components with codes
 */
export interface ExamComponentWithCode {
  code?: ExamCodeableConcept;
  bodySite?: ExamCodeableConcept;
}

/**
 * Checkbox component
 */
export interface ExamCardCheckboxComponent extends ExamComponentWithCode {
  label: string;
  defaultValue: boolean;
  type: 'checkbox';
}

/**
 * Dropdown option within a dropdown component
 */
export interface ExamCardDropdownOption extends ExamComponentWithCode {
  label: string;
  defaultValue: boolean;
  type: 'option';
}

/**
 * Dropdown component with selectable options
 */
export interface ExamCardDropdownComponent {
  label: string;
  placeholder?: string;
  type: 'dropdown';
  components: Record<string, ExamCardDropdownOption>;
}

/**
 * Text component for comments
 */
export interface ExamCardTextComponent {
  label: string;
  type: 'text';
  code?: ExamCodeableConcept;
}

/**
 * Column component (can contain nested components)
 */
export interface ExamCardColumnComponent {
  label: string;
  type: 'column';
  components: Record<string, ExamCardComponent>;
}

/**
 * Form field option
 */
export interface ExamCardFormFieldOption {
  label: string;
}

/**
 * Form field with conditional logic
 */
export interface ExamCardFormField {
  label: string;
  type: 'radio' | 'dropdown' | 'text';
  enabledWhen?: {
    field: string;
    value: string;
  };
  options?: Record<string, ExamCardFormFieldOption>;
}

/**
 * Form element within a form component
 */
export interface ExamCardFormElement extends ExamComponentWithCode {
  defaultValue: boolean;
  type: 'form-element';
}

/**
 * Form component with fields and elements
 */
export interface ExamCardFormComponent {
  label: string;
  type: 'form';
  components: Record<string, ExamCardFormElement>;
  fields: Record<string, ExamCardFormField>;
}

/**
 * Multi-select option
 */
export interface ExamCardMultiSelectOption extends ExamComponentWithCode {
  label: string;
  defaultValue: boolean;
  description?: string;
}

/**
 * Multi-select component
 */
export interface ExamCardMultiSelectComponent extends ExamComponentWithCode {
  label: string;
  defaultValue?: boolean;
  type: 'multi-select';
  options: Record<string, ExamCardMultiSelectOption>;
}

/**
 * Union of all non-text exam card components
 */
export type ExamCardNonTextComponent =
  | ExamCardCheckboxComponent
  | ExamCardDropdownComponent
  | ExamCardColumnComponent
  | ExamCardFormComponent
  | ExamCardMultiSelectComponent;

/**
 * Union of all exam card component types
 */
export type ExamCardComponent = ExamCardNonTextComponent | ExamCardTextComponent;

/**
 * Exam card with normal, abnormal, and comment sections
 */
export interface ExamCard {
  label: string;
  components: {
    normal: Record<string, ExamCardNonTextComponent>;
    abnormal: Record<string, ExamCardNonTextComponent>;
    comment: Record<string, ExamCardTextComponent>;
  };
}

/**
 * Collection of exam cards
 */
export type ExamItemConfig = Record<string, ExamCard>;

/**
 * Versioned exam configuration instance
 */
export interface ExamTypeInstance {
  version: string;
  components: ExamItemConfig;
}

/**
 * Full examination configuration
 */
export interface ExaminationConfig {
  telemed: Record<string, ExamTypeInstance>;
  inPerson: Record<string, ExamTypeInstance>;
}

/**
 * Exam type enum values
 */
export type ExamTypeValue = 'telemed' | 'inPerson';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for an 8 character hexadecimal hash string
 */
export const HexHashSchema = z.string().regex(/^[a-f0-9]{8}$/, 'Must be a valid 8-character hexadecimal hash string');

/**
 * Schema for checkbox component
 */
export const ExamCardCheckboxComponentSchema: z.ZodType<ExamCardCheckboxComponent, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  type: z.literal('checkbox'),
  code: ExamCodeableConceptSchema.optional(),
  bodySite: ExamCodeableConceptSchema.optional(),
});

/**
 * Schema for dropdown option component
 */
export const ExamCardDropdownOptionSchema: z.ZodType<ExamCardDropdownOption, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  type: z.literal('option'),
  code: ExamCodeableConceptSchema.optional(),
  bodySite: ExamCodeableConceptSchema.optional(),
});

/**
 * Schema for dropdown component
 */
export const ExamCardDropdownComponentSchema: z.ZodType<ExamCardDropdownComponent, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  type: z.literal('dropdown'),
  components: z.record(z.string(), ExamCardDropdownOptionSchema),
});

/**
 * Schema for text component
 */
export const ExamCardTextComponentSchema: z.ZodType<ExamCardTextComponent, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.literal('text'),
  code: ExamCodeableConceptSchema.optional(),
});

/**
 * Schema for form field option
 */
export const ExamCardFormFieldOptionSchema: z.ZodType<ExamCardFormFieldOption, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
});

/**
 * Schema for form field
 */
export const ExamCardFormFieldSchema: z.ZodType<ExamCardFormField, z.ZodTypeDef, unknown> = z.object({
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

/**
 * Schema for form element
 */
export const ExamCardFormElementSchema: z.ZodType<ExamCardFormElement, z.ZodTypeDef, unknown> = z.object({
  defaultValue: z.boolean(),
  type: z.literal('form-element'),
  code: ExamCodeableConceptSchema.optional(),
  bodySite: ExamCodeableConceptSchema.optional(),
});

/**
 * Schema for form component
 */
export const ExamCardFormComponentSchema: z.ZodType<ExamCardFormComponent, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.literal('form'),
  components: z.record(z.string(), ExamCardFormElementSchema),
  fields: z.record(z.string(), ExamCardFormFieldSchema),
});

/**
 * Schema for multi-select option
 */
export const ExamCardMultiSelectOptionSchema: z.ZodType<ExamCardMultiSelectOption, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  defaultValue: z.boolean(),
  description: z.string().optional(),
  code: ExamCodeableConceptSchema.optional(),
  bodySite: ExamCodeableConceptSchema.optional(),
});

/**
 * Schema for multi-select component
 */
export const ExamCardMultiSelectComponentSchema: z.ZodType<ExamCardMultiSelectComponent, z.ZodTypeDef, unknown> =
  z.object({
    label: z.string().min(1, 'Label is required'),
    defaultValue: z.boolean().optional(),
    type: z.literal('multi-select'),
    options: z.record(z.string(), ExamCardMultiSelectOptionSchema),
    code: ExamCodeableConceptSchema.optional(),
    bodySite: ExamCodeableConceptSchema.optional(),
  });

/**
 * Schema for column component (uses lazy for recursion)
 */
export const ExamCardColumnComponentSchema: z.ZodType<ExamCardColumnComponent, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    label: z.string().min(1, 'Label is required'),
    type: z.literal('column'),
    components: z.record(z.string(), ExamCardComponentSchema),
  })
);

/**
 * Union schema for non-text components
 */
export const ExamCardNonTextComponentSchema: z.ZodType<ExamCardNonTextComponent, z.ZodTypeDef, unknown> = z.union([
  ExamCardCheckboxComponentSchema,
  ExamCardDropdownComponentSchema,
  ExamCardColumnComponentSchema,
  ExamCardFormComponentSchema,
  ExamCardMultiSelectComponentSchema,
]);

/**
 * Union schema for all component types
 */
export const ExamCardComponentSchema: z.ZodType<ExamCardComponent, z.ZodTypeDef, unknown> = z.union([
  ExamCardNonTextComponentSchema,
  ExamCardTextComponentSchema,
]);

/**
 * Schema for exam card
 */
export const ExamCardSchema: z.ZodType<ExamCard, z.ZodTypeDef, unknown> = z.object({
  label: z.string().min(1, 'Label is required'),
  components: z.object({
    normal: z.record(z.string(), ExamCardNonTextComponentSchema),
    abnormal: z.record(z.string(), ExamCardNonTextComponentSchema),
    comment: z.record(z.string(), ExamCardTextComponentSchema),
  }),
});

/**
 * Schema for exam item config
 */
export const ExamItemConfigSchema: z.ZodType<ExamItemConfig, z.ZodTypeDef, unknown> = z.record(
  z.string(),
  ExamCardSchema
);

/**
 * Schema for exam type instance
 */
export const ExamTypeInstanceSchema: z.ZodType<Record<string, ExamTypeInstance>, z.ZodTypeDef, unknown> = z.record(
  z.string(),
  z.object({
    version: HexHashSchema,
    components: ExamItemConfigSchema,
  })
);

/**
 * Schema for full examination config
 */
export const ExaminationConfigSchema: z.ZodType<ExaminationConfig, z.ZodTypeDef, unknown> = z.object({
  telemed: ExamTypeInstanceSchema,
  inPerson: ExamTypeInstanceSchema,
});

/**
 * Validation function for examination config
 */
export const validateExaminationConfig = (config: unknown): ExaminationConfig => {
  return ExaminationConfigSchema.parse(config);
};

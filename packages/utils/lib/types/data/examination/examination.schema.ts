import { z } from 'zod';
import { CodeableConceptSchema } from '../../fhir';
import { ExamSchema } from './examination';

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

// Union schema for non-text components
const ExamCardNonTextComponentSchema = z.union([
  ExamCardCheckboxComponentSchema,
  ExamCardDropdownComponentSchema,
  ExamCardColumnComponentSchema,
]);

// Union schema for all component types
const ExamCardComponentSchema = z.union([ExamCardNonTextComponentSchema, ExamCardTextComponentSchema]);

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

// Schema for exam config type
const ExamConfigTypeSchema = z.object({
  telemed: z.record(
    z.string(),
    z.object({
      components: ExamItemConfigSchema,
    })
  ),
  inPerson: z.record(
    z.string(),
    z.object({
      components: ExamItemConfigSchema,
    })
  ),
});

export { ExamConfigTypeSchema };

export const validateExamConfig = (config: unknown): ExamSchema => {
  return ExamConfigTypeSchema.parse(config);
};

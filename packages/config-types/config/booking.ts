import z from 'zod';
import { FormSectionArraySchema, FormSectionSimpleSchema, QuestionnaireConfigSchema } from './form-fields';
import { QuestionnaireBaseSchema } from './questionnaire';

/**
 * StrongCoding - A stricter version of FHIR Coding with required fields
 * Used for service categories and other coded values that must be complete
 */
export const StrongCodingSchema = z.object({
  code: z.string(),
  display: z.string(),
  system: z.string(),
});

export type StrongCoding = z.infer<typeof StrongCodingSchema>;

/**
 * BookingOption - An option displayed on the booking UI
 */
export const BookingOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export type BookingOption = z.infer<typeof BookingOptionSchema>;

/**
 * VisitType - Types of visits that can be booked
 */
export enum VisitType {
  InPersonWalkIn = 'in-person-walk-in',
  InPersonPreBook = 'in-person-pre-booked',
  InPersonPostTelemed = 'in-person-post-telemed',
  VirtualOnDemand = 'virtual-on-demand',
  VirtualScheduled = 'virtual-scheduled',
}

/**
 * CanonicalUrl - A FHIR canonical URL reference (url|version)
 */
export type CanonicalUrl = `${string}|${string}`;

/**
 * ReasonsForVisitByMode - Reason-for-visit options keyed by service mode
 * 'default' is used as a fallback when no mode-specific list is defined
 */
const LabelValueOptionSchema = z.object({ label: z.string(), value: z.string() });

export const ReasonsForVisitByModeSchema = z.object({
  default: z.array(LabelValueOptionSchema).optional(),
  'in-person': z.array(LabelValueOptionSchema).optional(),
  virtual: z.array(LabelValueOptionSchema).optional(),
});

export type ReasonsForVisitByMode = z.infer<typeof ReasonsForVisitByModeSchema>;

/**
 * ServiceCategoryConfig - A service category with its available modes, visit types, and optional RFV options
 */
export const ServiceCategoryConfigSchema = z.object({
  category: StrongCodingSchema,
  serviceModes: z.array(z.enum(['in-person', 'virtual'])),
  visitTypes: z.array(z.enum(['prebook', 'walk-in'])),
  reasonsForVisit: ReasonsForVisitByModeSchema.optional(),
});

export type ServiceCategoryConfig = z.infer<typeof ServiceCategoryConfigSchema>;

/**
 * BookingConfig - Configuration for the booking flow
 * Defines available service categories, homepage options, and form configuration
 */
export const BookingConfigSchema = z.object({
  homepageOptions: z.array(BookingOptionSchema),
  ehrBookingOptions: z.array(BookingOptionSchema),
  serviceCategories: z.array(ServiceCategoryConfigSchema),
  formConfig: QuestionnaireConfigSchema,
  inPersonPrebookRoutingParams: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
  defaultWalkinLocationName: z.string().optional(),
  FormFields: z.record(z.string(), z.union([FormSectionSimpleSchema, FormSectionArraySchema])).optional(),
  questionnaireBase: QuestionnaireBaseSchema.optional(),
  hiddenFormSections: z.array(z.string()).optional(),
  // Optional questionnaire canonical URLs for slot creation
  virtualQuestionnaireCanonical: z.custom<CanonicalUrl>().optional(),
  inPersonQuestionnaireCanonical: z.custom<CanonicalUrl>().optional(),
});

export type BookingConfig = z.infer<typeof BookingConfigSchema>;

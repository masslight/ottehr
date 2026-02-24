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
 * BookingConfig - Configuration for the booking flow
 * Defines available service categories, homepage options, and form configuration
 */
export const BookingConfigSchema = z.object({
  serviceCategoriesEnabled: z.object({
    serviceModes: z.array(z.string()),
    visitType: z.array(z.string()),
  }),
  homepageOptions: z.array(BookingOptionSchema),
  ehrBookingOptions: z.array(BookingOptionSchema),
  serviceCategories: z.array(StrongCodingSchema),
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

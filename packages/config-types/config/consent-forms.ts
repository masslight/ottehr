import z from 'zod';

/**
 * CodingSchema - FHIR Coding structure for consent form types
 */
export const ConsentFormCodingSchema = z.object({
  system: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
});

export type ConsentFormCoding = z.infer<typeof ConsentFormCodingSchema>;

/**
 * PathConfigSchema - Path that can vary by state
 * Either a simple string or an object with default and state-specific overrides
 */
export const PathConfigSchema = z.union([
  z.string(),
  z.object({
    default: z.string(),
    byState: z.record(z.string(), z.string()).optional(),
  }),
]);

export type PathConfig = z.infer<typeof PathConfigSchema>;

/**
 * ConsentFormSchema - Definition of a single consent form
 */
export const ConsentFormSchema = z.object({
  id: z.string(),
  formTitle: z.string(),
  resourceTitle: z.string(),
  type: z.object({
    coding: z.array(ConsentFormCodingSchema).min(1),
    text: z.string().optional(),
  }),
  createsConsentResource: z.boolean(),
  assetPath: PathConfigSchema,
  publicUrl: PathConfigSchema,
});

export type ConsentFormConfig = z.infer<typeof ConsentFormSchema>;

/**
 * ConsentFormsConfigSchema - Collection of consent forms
 */
export const ConsentFormsConfigSchema = z.object({
  forms: z.array(ConsentFormSchema).min(1),
});

export type ConsentFormsConfig = z.infer<typeof ConsentFormsConfigSchema>;

/**
 * ResolvedConsentFormConfig - Consent form with paths resolved to strings
 * Used after state-specific path resolution has been applied
 */
export type ResolvedConsentFormConfig = Omit<ConsentFormConfig, 'assetPath' | 'publicUrl'> & {
  assetPath: string;
  publicUrl: string;
};

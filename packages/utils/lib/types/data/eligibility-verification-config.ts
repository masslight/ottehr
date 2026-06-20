import { z } from 'zod';
import { MAX_ELIGIBILITY_SHORT_LIST_CODES } from '../../utils/eligibility-verification-config';

// The eligibility verification configuration controls which copay service-type codes are surfaced
// on the eligibility short list (the "Patient payment" box) and which single code's copay is shown
// on the Payment Considerations screen.
export interface EligibilityVerificationConfig {
  // Up to MAX_ELIGIBILITY_SHORT_LIST_CODES service-type codes to surface on the eligibility short list.
  shortListCodes: string[];
  // The single code whose copay is surfaced on the Payment Considerations screen.
  primaryCode?: string;
}

export type GetEligibilityVerificationConfigInput = Record<string, never>;

export type GetEligibilityVerificationConfigOutput = EligibilityVerificationConfig & {
  // FHIR id of the Basic resource backing this config; undefined until it has been saved once.
  id?: string;
};

export const AdminUpdateEligibilityVerificationConfigInputSchema = z
  .object({
    shortListCodes: z.array(z.string().min(1)).max(MAX_ELIGIBILITY_SHORT_LIST_CODES),
    primaryCode: z.string().min(1).optional(),
  })
  .refine((config) => config.primaryCode === undefined || config.shortListCodes.includes(config.primaryCode), {
    message: 'primaryCode must be one of the shortListCodes',
    path: ['primaryCode'],
  });

export type AdminUpdateEligibilityVerificationConfigInput = z.infer<
  typeof AdminUpdateEligibilityVerificationConfigInputSchema
>;

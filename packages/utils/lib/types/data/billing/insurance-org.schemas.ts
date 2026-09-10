import { z } from 'zod';
import { NioContactSchema } from './non-insurance-org.schemas';

const nonEmptyString = z.string().trim().min(1);
const nonNegativeInt = z.number().int().nonnegative();

export const INSURANCE_ORG_TYPES = ['workers-comp', 'auto', 'medical', 'other'] as const;
export type InsuranceOrgType = (typeof INSURANCE_ORG_TYPES)[number];

export const INSURANCE_ORG_SUBMISSION_MECHANISMS = ['email', 'portal', 'fax', 'mail'] as const;
export type InsuranceOrgSubmissionMechanism = (typeof INSURANCE_ORG_SUBMISSION_MECHANISMS)[number];

export const INSURANCE_ORG_CLAIM_FORMS = ['cms-1500', 'cms-1450', 'other'] as const;
export type InsuranceOrgClaimForm = (typeof INSURANCE_ORG_CLAIM_FORMS)[number];

const orgIdSchema = z
  .string()
  .trim()
  .regex(/^OTR-.+$/, 'Id must start with "OTR-"');

export const InsuranceOrgAddressSchema = z.object({
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
});
export type InsuranceOrgAddress = z.output<typeof InsuranceOrgAddressSchema>;

// Mechanism-specific submission details; which of these is relevant is driven by
// submissionMechanism, but nothing here enforces that cross-field rule server-side — the UI only
// ever collects the field(s) for the currently selected mechanism.
export const InsuranceOrgSubmissionDetailsSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional(),
  portalUrl: z.string().trim().optional(),
  portalDetails: z.string().trim().optional(),
  faxNumber: z.string().trim().optional(),
  mailAddress: InsuranceOrgAddressSchema.optional(),
});
export type InsuranceOrgSubmissionDetails = z.output<typeof InsuranceOrgSubmissionDetailsSchema>;

export const CreateInsuranceOrgInputSchema = z.object({
  orgId: orgIdSchema,
  name: nonEmptyString,
  insuranceTypes: z.array(z.enum(INSURANCE_ORG_TYPES)).default([]),
  submissionMechanism: z.enum(INSURANCE_ORG_SUBMISSION_MECHANISMS),
  submissionDetails: InsuranceOrgSubmissionDetailsSchema.optional(),
  note: z.string().trim().optional(),
  acceptedClaimForm: z.enum(INSURANCE_ORG_CLAIM_FORMS),
  contacts: z.array(NioContactSchema).optional(),
});
export type CreateInsuranceOrgInput = z.output<typeof CreateInsuranceOrgInputSchema>;

export const UpdateInsuranceOrgInputSchema = CreateInsuranceOrgInputSchema.extend({
  insuranceOrgId: nonEmptyString,
});
export type UpdateInsuranceOrgInput = z.output<typeof UpdateInsuranceOrgInputSchema>;

export const SearchInsuranceOrgsInputSchema = z.object({
  insuranceOrgId: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});
export type SearchInsuranceOrgsInput = z.output<typeof SearchInsuranceOrgsInputSchema>;

export const DeleteInsuranceOrgInputSchema = z.object({
  insuranceOrgId: nonEmptyString,
});
export type DeleteInsuranceOrgInput = z.output<typeof DeleteInsuranceOrgInputSchema>;

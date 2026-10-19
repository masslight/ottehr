import { z } from 'zod';
import { NioContactSchema } from './non-insurance-org.schemas';

const nonEmptyString = z.string().trim().min(1);
const nonNegativeInt = z.number().int().nonnegative();

export const CUSTOM_INSURANCE_ORG_TYPES = ['workers-comp', 'auto', 'medical', 'other'] as const;
export type CustomInsuranceOrgType = (typeof CUSTOM_INSURANCE_ORG_TYPES)[number];

export const CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISMS = ['email', 'portal', 'fax', 'mail'] as const;
export type CustomInsuranceOrgSubmissionMechanism = (typeof CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISMS)[number];

export const CUSTOM_INSURANCE_ORG_CLAIM_FORMS = ['cms-1500', 'cms-1450', 'other'] as const;
export type CustomInsuranceOrgClaimForm = (typeof CUSTOM_INSURANCE_ORG_CLAIM_FORMS)[number];

const orgIdSchema = z
  .string()
  .trim()
  .regex(/^OTR-.+$/, 'Id must start with "OTR-"');

export const CustomInsuranceOrgAddressSchema = z.object({
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
});
export type CustomInsuranceOrgAddress = z.output<typeof CustomInsuranceOrgAddressSchema>;

// Mechanism-specific submission details; which of these is relevant is driven by
// submissionMechanism, but nothing here enforces that cross-field rule server-side — the UI only
// ever collects the field(s) for the currently selected mechanism.
export const CustomInsuranceOrgSubmissionDetailsSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional(),
  portalUrl: z.string().trim().optional(),
  portalDetails: z.string().trim().optional(),
  faxNumber: z.string().trim().optional(),
  mailAddress: CustomInsuranceOrgAddressSchema.optional(),
});
export type CustomInsuranceOrgSubmissionDetails = z.output<typeof CustomInsuranceOrgSubmissionDetailsSchema>;

export const CreateCustomInsuranceOrgInputSchema = z.object({
  orgId: orgIdSchema,
  name: nonEmptyString,
  insuranceTypes: z.array(z.enum(CUSTOM_INSURANCE_ORG_TYPES)).default([]),
  submissionMechanism: z.enum(CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISMS),
  submissionDetails: CustomInsuranceOrgSubmissionDetailsSchema.optional(),
  note: z.string().trim().optional(),
  acceptedClaimForm: z.enum(CUSTOM_INSURANCE_ORG_CLAIM_FORMS),
  contacts: z.array(NioContactSchema).optional(),
});
export type CreateCustomInsuranceOrgInput = z.output<typeof CreateCustomInsuranceOrgInputSchema>;

export const UpdateCustomInsuranceOrgInputSchema = CreateCustomInsuranceOrgInputSchema.extend({
  insuranceOrgId: nonEmptyString,
});
export type UpdateCustomInsuranceOrgInput = z.output<typeof UpdateCustomInsuranceOrgInputSchema>;

export const SearchCustomInsuranceOrgsInputSchema = z.object({
  insuranceOrgId: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});
export type SearchCustomInsuranceOrgsInput = z.output<typeof SearchCustomInsuranceOrgsInputSchema>;

export const DeleteCustomInsuranceOrgInputSchema = z.object({
  insuranceOrgId: nonEmptyString,
});
export type DeleteCustomInsuranceOrgInput = z.output<typeof DeleteCustomInsuranceOrgInputSchema>;

// Clinical directory (list-custom-insurance-organizations) — the stable clinical-facing contract.
export const ListCustomInsuranceOrganizationsInputSchema = z.object({
  insuranceOrgId: nonEmptyString.optional(),
  search: nonEmptyString.optional(),
});
export type ListCustomInsuranceOrganizationsInput = z.output<typeof ListCustomInsuranceOrganizationsInputSchema>;

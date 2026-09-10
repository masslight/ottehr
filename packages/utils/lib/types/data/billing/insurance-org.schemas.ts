import { z } from 'zod';

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

export const CreateInsuranceOrgInputSchema = z.object({
  orgId: orgIdSchema,
  name: nonEmptyString,
  insuranceTypes: z.array(z.enum(INSURANCE_ORG_TYPES)).default([]),
  submissionMechanism: z.enum(INSURANCE_ORG_SUBMISSION_MECHANISMS),
  note: z.string().trim().optional(),
  acceptedClaimForm: z.enum(INSURANCE_ORG_CLAIM_FORMS),
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

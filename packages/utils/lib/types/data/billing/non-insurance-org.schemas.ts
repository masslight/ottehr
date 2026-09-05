import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const nonNegativeInt = z.number().int().nonnegative();
const optionalTrimmedString = z.string().trim().optional();

export const NIO_COVERAGE_CATEGORIES = ['workers-comp', 'occupational-medicine', 'other'] as const;
export type NioCoverageCategory = (typeof NIO_COVERAGE_CATEGORIES)[number];

export const NIO_SUBMISSION_MECHANISMS = ['email', 'portal', 'fax', 'mail'] as const;
export type NioSubmissionMechanism = (typeof NIO_SUBMISSION_MECHANISMS)[number];

export const NIO_WC_BILLING_MODES = ['insurance', 'direct'] as const;
export type NioWcBillingMode = (typeof NIO_WC_BILLING_MODES)[number];

export const NioAddressSchema = z.object({
  line1: optionalTrimmedString,
  line2: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  zip: optionalTrimmedString,
});
export type NioAddress = z.output<typeof NioAddressSchema>;

export const NioContactSchema = z.object({
  name: nonEmptyString,
  title: optionalTrimmedString,
  phone: optionalTrimmedString,
  email: z.string().trim().email('Invalid contact email').optional(),
});
export type NioContact = z.output<typeof NioContactSchema>;

export const NioSubmissionSchema = z.object({
  preferredMechanism: z.enum(NIO_SUBMISSION_MECHANISMS).optional(),
  email: z.string().trim().email('Invalid submission email').optional(),
  fax: optionalTrimmedString,
  portalNotes: optionalTrimmedString,
  mailAddress: NioAddressSchema.optional(),
});
export type NioSubmission = z.output<typeof NioSubmissionSchema>;

const workersCompCoverageSchema = z.object({
  category: z.literal('workers-comp'),
  billingMode: z.enum(NIO_WC_BILLING_MODES),
  // RCM payer Organization id, the token PayerSelect stores (BillingPayerOption.id); insurance mode only.
  payerId: nonEmptyString.optional(),
  // Manual submission details; direct mode only.
  submission: NioSubmissionSchema.optional(),
});

const occupationalMedicineCoverageSchema = z.object({
  category: z.literal('occupational-medicine'),
  submission: NioSubmissionSchema.optional(),
});

const otherCoverageSchema = z.object({
  category: z.literal('other'),
  name: optionalTrimmedString,
  submission: NioSubmissionSchema.optional(),
});

export const NioCoverageSchema = z.discriminatedUnion('category', [
  workersCompCoverageSchema,
  occupationalMedicineCoverageSchema,
  otherCoverageSchema,
]);
export type NioCoverageInput = z.output<typeof NioCoverageSchema>;

const coversSchema = z.array(NioCoverageSchema).superRefine((covers, ctx) => {
  const seen = new Set<string>();
  covers.forEach((coverage, index) => {
    if (seen.has(coverage.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate coverage category "${coverage.category}"`,
        path: [index, 'category'],
      });
    }
    seen.add(coverage.category);
  });
});

export const CreateNonInsuranceOrgInputSchema = z.object({
  name: nonEmptyString,
  employer: z.boolean(),
  address: NioAddressSchema.optional(),
  contacts: z.array(NioContactSchema).optional(),
  covers: coversSchema.optional(),
});
export type CreateNonInsuranceOrgInput = z.output<typeof CreateNonInsuranceOrgInputSchema>;

export const UpdateNonInsuranceOrgInputSchema = CreateNonInsuranceOrgInputSchema.extend({
  nioId: nonEmptyString,
});
export type UpdateNonInsuranceOrgInput = z.output<typeof UpdateNonInsuranceOrgInputSchema>;

export const SearchNonInsuranceOrgsInputSchema = z.object({
  nioId: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  // The only supported filter is employers-only; omit for all NIOs.
  employer: z.literal(true).optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});
export type SearchNonInsuranceOrgsInput = z.output<typeof SearchNonInsuranceOrgsInputSchema>;

export const DeleteNonInsuranceOrgInputSchema = z.object({
  nioId: nonEmptyString,
});
export type DeleteNonInsuranceOrgInput = z.output<typeof DeleteNonInsuranceOrgInputSchema>;

// Clinical directory (list-non-insurance-organizations) — the stable clinical-facing contract.
export const ListNonInsuranceOrganizationsInputSchema = z.object({
  nioId: nonEmptyString.optional(),
  employerOnly: z.literal(true).optional(),
  search: nonEmptyString.optional(),
});
export type ListNonInsuranceOrganizationsInput = z.output<typeof ListNonInsuranceOrganizationsInputSchema>;

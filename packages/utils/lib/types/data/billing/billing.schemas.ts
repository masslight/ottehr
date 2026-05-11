import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const nonNegativeInt = z.number().int().nonnegative();

export const ALLOWED_BILLING_RESOURCE_TYPES = [
  'Patient',
  'Coverage',
  'Practitioner',
  'Organization',
  'Location',
] as const;

// --- Input schemas ---

export const GetClaimDetailInputSchema = z.object({
  claimId: nonEmptyString,
});

export const GetPatientCoveragesInputSchema = z.object({
  patientId: nonEmptyString,
});

export const GetBillingClaimsInputSchema = z.object({
  searchText: nonEmptyString.optional(),
  status: nonEmptyString.optional(),
  dosFrom: nonEmptyString.optional(),
  dosTo: nonEmptyString.optional(),
  payerName: nonEmptyString.optional(),
  payerId: nonEmptyString.optional(),
  patientId: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const GetBillingProvidersInputSchema = z.object({
  providerType: z.enum(['rendering', 'billing']),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SearchBillingPatientsInputSchema = z.object({
  name: nonEmptyString.optional(),
  dob: nonEmptyString.optional(),
  identifier: nonEmptyString.optional(),
  uuid: z.string().uuid().optional(),
});

export const SearchBillingPractitionersInputSchema = z.object({
  name: nonEmptyString.optional(),
});

export const SearchBillingLocationsInputSchema = z.object({
  name: nonEmptyString.optional(),
});

export const SearchBillingOrganizationsInputSchema = z.object({
  name: nonEmptyString.optional(),
  type: nonEmptyString.optional(),
});

export const CreateBillingClaimInputSchema = z.object({
  patientId: nonEmptyString,
  patientOverrides: z
    .object({
      firstName: nonEmptyString.optional(),
      lastName: nonEmptyString.optional(),
      dob: nonEmptyString.optional(),
      gender: nonEmptyString.optional(),
    })
    .strict()
    .optional(),
  coverageId: nonEmptyString.optional(),
  coverageOverrides: z
    .object({
      subscriberId: nonEmptyString.optional(),
    })
    .strict()
    .optional(),
  practitionerId: nonEmptyString.optional(),
  practitionerOverrides: z
    .object({
      firstName: nonEmptyString.optional(),
      lastName: nonEmptyString.optional(),
      npi: nonEmptyString.optional(),
    })
    .strict()
    .optional(),
  facilityId: nonEmptyString.optional(),
  facilityOverrides: z
    .object({
      name: nonEmptyString.optional(),
    })
    .strict()
    .optional(),
  billingProviderId: nonEmptyString.optional(),
  diagnoses: z
    .array(
      z.object({
        code: nonEmptyString,
        display: z.string().optional(),
      })
    )
    .optional(),
  serviceLines: z
    .array(
      z.object({
        cptCode: nonEmptyString,
        units: z.number().positive(),
        charges: z.number(),
        serviceDate: nonEmptyString,
        placeOfService: z.string().optional(),
        modifiers: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

export const CreateBillingWorkingCopyInputSchema = z.object({
  resourceType: z.enum(ALLOWED_BILLING_RESOURCE_TYPES),
  resourceId: nonEmptyString,
  overrides: z.record(z.unknown()).optional(),
});

export const UpdateBillingClaimInputSchema = z.object({
  resourceId: nonEmptyString,
  resourceType: z.enum([...ALLOWED_BILLING_RESOURCE_TYPES, 'Claim']).default('Claim'),
  operations: z
    .array(
      z.object({
        op: z.enum(['add', 'replace', 'remove']),
        path: z.string().startsWith('/'),
        value: z.unknown().optional(),
      })
    )
    .min(1),
});

export type GetClaimDetailInput = z.infer<typeof GetClaimDetailInputSchema>;
export type GetPatientCoveragesInput = z.infer<typeof GetPatientCoveragesInputSchema>;
export type GetBillingClaimsInput = z.infer<typeof GetBillingClaimsInputSchema>;
export type GetBillingProvidersInput = z.infer<typeof GetBillingProvidersInputSchema>;
export type SearchBillingPatientsInput = z.infer<typeof SearchBillingPatientsInputSchema>;
export type SearchBillingPractitionersInput = z.infer<typeof SearchBillingPractitionersInputSchema>;
export type SearchBillingLocationsInput = z.infer<typeof SearchBillingLocationsInputSchema>;
export type SearchBillingOrganizationsInput = z.infer<typeof SearchBillingOrganizationsInputSchema>;
export type CreateBillingClaimInput = z.infer<typeof CreateBillingClaimInputSchema>;
export type CreateBillingWorkingCopyInput = z.infer<typeof CreateBillingWorkingCopyInputSchema>;
export type UpdateBillingClaimInput = z.infer<typeof UpdateBillingClaimInputSchema>;
export type BillingResourceType = (typeof ALLOWED_BILLING_RESOURCE_TYPES)[number];

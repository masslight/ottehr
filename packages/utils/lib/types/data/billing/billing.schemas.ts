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

export const SearchBillingClaimsInputSchema = z.object({
  searchText: nonEmptyString.optional(),
  status: nonEmptyString.optional(),
  createdFrom: nonEmptyString.optional(),
  createdTo: nonEmptyString.optional(),
  payerName: nonEmptyString.optional(),
  payerId: nonEmptyString.optional(),
  patientId: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SearchBillingProvidersInputSchema = z.object({
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

export const UpdateBillingResourceInputSchema = z.discriminatedUnion('resourceType', [
  z.object({
    resourceType: z.literal('Patient'),
    resourceId: nonEmptyString,
    fields: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dob: z.string().optional(),
      gender: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Practitioner'),
    resourceId: nonEmptyString,
    fields: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Coverage'),
    resourceId: nonEmptyString,
    fields: z.object({
      subscriberId: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Location'),
    resourceId: nonEmptyString,
    fields: z.object({
      name: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Organization'),
    resourceId: nonEmptyString,
    fields: z.object({
      name: z.string().optional(),
    }),
  }),
]);

export type GetClaimDetailInput = z.infer<typeof GetClaimDetailInputSchema>;
export type GetPatientCoveragesInput = z.infer<typeof GetPatientCoveragesInputSchema>;
export type SearchBillingClaimsInput = z.infer<typeof SearchBillingClaimsInputSchema>;
export type SearchBillingProvidersInput = z.infer<typeof SearchBillingProvidersInputSchema>;
export type SearchBillingPatientsInput = z.infer<typeof SearchBillingPatientsInputSchema>;
export type SearchBillingPractitionersInput = z.infer<typeof SearchBillingPractitionersInputSchema>;
export type SearchBillingLocationsInput = z.infer<typeof SearchBillingLocationsInputSchema>;
export type SearchBillingOrganizationsInput = z.infer<typeof SearchBillingOrganizationsInputSchema>;
export type CreateBillingClaimInput = z.infer<typeof CreateBillingClaimInputSchema>;
export type CreateBillingWorkingCopyInput = z.infer<typeof CreateBillingWorkingCopyInputSchema>;
export type UpdateBillingResourceInput = z.infer<typeof UpdateBillingResourceInputSchema>;
export type BillingResourceType = (typeof ALLOWED_BILLING_RESOURCE_TYPES)[number];

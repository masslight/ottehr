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

export const GetEraDetailInputSchema = z.object({
  eraId: nonEmptyString,
});

export const SearchErasInputSchema = z.object({
  // ERA-level filters (work for matched + unmatched)
  eraId: nonEmptyString.optional(),
  checkNumber: nonEmptyString.optional(),
  eraDateFrom: nonEmptyString.optional(),
  eraDateTo: nonEmptyString.optional(),
  eraStatus: nonEmptyString.optional(),
  payerId: nonEmptyString.optional(),
  payerName: nonEmptyString.optional(),
  // Claim-level filters (only ERAs with matched claims satisfying these)
  claimStatus: nonEmptyString.optional(),
  dosFrom: nonEmptyString.optional(),
  dosTo: nonEmptyString.optional(),
  patientId: nonEmptyString.optional(),
  searchText: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SaveBillingTagInputSchema = z.object({
  tagId: nonEmptyString.optional(),
  name: nonEmptyString,
  description: z.string().optional(),
});

export const DeleteBillingTagInputSchema = z.object({
  tagId: nonEmptyString,
});

export const TagBillingClaimInputSchema = z.object({
  claimId: nonEmptyString,
  action: z.enum(['add', 'remove']),
  tagName: nonEmptyString,
});

export const GetPatientDetailInputSchema = z.object({
  patientId: nonEmptyString,
});

export const GetPatientCoveragesInputSchema = z.object({
  patientId: nonEmptyString,
});

export const SearchBillingClaimsInputSchema = z.object({
  searchText: nonEmptyString.optional(),
  status: nonEmptyString.optional(),
  tag: nonEmptyString.optional(),
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
  providerId: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
  includeWorkingCopies: z.boolean().optional(),
});

export const SearchBillingPatientsInputSchema = z.object({
  name: nonEmptyString.optional(),
  dob: nonEmptyString.optional(),
  identifier: nonEmptyString.optional(),
  uuid: z.string().uuid().optional(),
  includeWorkingCopies: z.boolean().optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SearchBillingLocationsInputSchema = z.object({
  name: nonEmptyString.optional(),
  includeWorkingCopies: z.boolean().optional(),
});

export const SearchBillingPayersInputSchema = z.object({
  name: nonEmptyString.optional(),
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
  renderingProvider: z
    .object({
      id: nonEmptyString,
      type: z.enum(['Practitioner', 'Organization']),
      overrides: z
        .object({
          firstName: nonEmptyString.optional(),
          lastName: nonEmptyString.optional(),
          npi: nonEmptyString.optional(),
        })
        .strict()
        .optional(),
    })
    .optional(),
  facilityId: nonEmptyString.optional(),
  facilityOverrides: z
    .object({
      name: nonEmptyString.optional(),
      npi: nonEmptyString.optional(),
      address: nonEmptyString.optional(),
    })
    .strict()
    .optional(),
  billingProvider: z
    .object({
      id: nonEmptyString,
      type: z.enum(['Practitioner', 'Organization']),
      overrides: z
        .object({
          name: nonEmptyString.optional(),
          npi: nonEmptyString.optional(),
          tin: nonEmptyString.optional(),
        })
        .strict()
        .optional(),
    })
    .optional(),
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

const billingProviderRole = z.enum(['billing', 'rendering']);

const billingAddressSchema = z
  .object({
    line1: nonEmptyString.optional(),
    line2: nonEmptyString.optional(),
    city: nonEmptyString.optional(),
    state: nonEmptyString.optional(),
    postalCode: nonEmptyString.optional(),
  })
  .strict();

export const CreateBillingProviderInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('individual'),
    firstName: nonEmptyString,
    lastName: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: nonEmptyString.optional(),
    taxonomyCode: nonEmptyString.optional(),
    licenseType: nonEmptyString.optional(),
    taxId: nonEmptyString.optional(),
    address: billingAddressSchema.optional(),
  }),
  z.object({
    kind: z.literal('organization'),
    name: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: nonEmptyString.optional(),
    taxonomyCode: nonEmptyString.optional(),
    taxId: nonEmptyString.optional(),
    address: billingAddressSchema.optional(),
  }),
]);

export const CreateBillingPatientInputSchema = z.object({
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  dob: nonEmptyString.optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  phone: nonEmptyString.optional(),
  address: billingAddressSchema.optional(),
});

export const UpdateBillingProviderInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('individual'),
    providerId: nonEmptyString,
    firstName: nonEmptyString,
    lastName: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: nonEmptyString.optional(),
    taxonomyCode: nonEmptyString.optional(),
    licenseType: nonEmptyString.optional(),
    taxId: nonEmptyString.optional(),
    address: billingAddressSchema.optional(),
  }),
  z.object({
    kind: z.literal('organization'),
    providerId: nonEmptyString,
    name: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: nonEmptyString.optional(),
    taxonomyCode: nonEmptyString.optional(),
    taxId: nonEmptyString.optional(),
    address: billingAddressSchema.optional(),
  }),
]);

export const UpdateBillingPatientInputSchema = z.object({
  patientId: nonEmptyString,
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  dob: nonEmptyString.optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  phone: nonEmptyString.optional(),
  email: nonEmptyString.optional(),
  address: billingAddressSchema.optional(),
});

export const CreateBillingWorkingCopyInputSchema = z.object({
  resourceType: z.enum(ALLOWED_BILLING_RESOURCE_TYPES),
  resourceId: nonEmptyString,
  overrides: z.record(z.unknown()).optional(),
});

const updatableAddressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
  })
  .optional();

const claimProviderRefSchema = z.object({
  id: nonEmptyString,
  type: z.enum(['Practitioner', 'Organization']),
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
      address: updatableAddressSchema,
    }),
  }),
  z.object({
    resourceType: z.literal('Practitioner'),
    resourceId: nonEmptyString,
    fields: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      npi: z.string().optional(),
      taxId: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Coverage'),
    resourceId: nonEmptyString,
    fields: z.object({
      subscriberId: z.string().optional(),
      status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']).optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Location'),
    resourceId: nonEmptyString,
    fields: z.object({
      name: z.string().optional(),
      npi: z.string().optional(),
      address: updatableAddressSchema,
    }),
  }),
  z.object({
    resourceType: z.literal('Organization'),
    resourceId: nonEmptyString,
    fields: z.object({
      name: z.string().optional(),
      npi: z.string().optional(),
      taxId: z.string().optional(),
    }),
  }),
  // Attach working copies for resources the claim was created without, or re-point the payer (RCM payer id).
  z.object({
    resourceType: z.literal('Claim'),
    resourceId: nonEmptyString,
    fields: z.object({
      billingProvider: claimProviderRefSchema.optional(),
      renderingProvider: claimProviderRefSchema.optional(),
      facilityId: nonEmptyString.optional(),
      coverageId: nonEmptyString.optional(),
      payerId: nonEmptyString.optional(),
    }),
  }),
]);

export type GetClaimDetailInput = z.infer<typeof GetClaimDetailInputSchema>;
export type GetEraDetailInput = z.infer<typeof GetEraDetailInputSchema>;
export type SearchErasInput = z.infer<typeof SearchErasInputSchema>;
export type SaveBillingTagInput = z.infer<typeof SaveBillingTagInputSchema>;
export type DeleteBillingTagInput = z.infer<typeof DeleteBillingTagInputSchema>;
export type TagBillingClaimInput = z.infer<typeof TagBillingClaimInputSchema>;
export type GetPatientDetailInput = z.infer<typeof GetPatientDetailInputSchema>;
export type GetPatientCoveragesInput = z.infer<typeof GetPatientCoveragesInputSchema>;
export type SearchBillingClaimsInput = z.infer<typeof SearchBillingClaimsInputSchema>;
export type SearchBillingProvidersInput = z.infer<typeof SearchBillingProvidersInputSchema>;
export type SearchBillingPatientsInput = z.infer<typeof SearchBillingPatientsInputSchema>;
export type SearchBillingLocationsInput = z.infer<typeof SearchBillingLocationsInputSchema>;
export type SearchBillingPayersInput = z.infer<typeof SearchBillingPayersInputSchema>;
export type CreateBillingClaimInput = z.infer<typeof CreateBillingClaimInputSchema>;
export type CreateBillingProviderInput = z.infer<typeof CreateBillingProviderInputSchema>;
export type CreateBillingPatientInput = z.infer<typeof CreateBillingPatientInputSchema>;
export type UpdateBillingPatientInput = z.infer<typeof UpdateBillingPatientInputSchema>;
export type UpdateBillingProviderInput = z.infer<typeof UpdateBillingProviderInputSchema>;
export type CreateBillingWorkingCopyInput = z.infer<typeof CreateBillingWorkingCopyInputSchema>;
export type UpdateBillingResourceInput = z.infer<typeof UpdateBillingResourceInputSchema>;
export type BillingResourceType = (typeof ALLOWED_BILLING_RESOURCE_TYPES)[number];

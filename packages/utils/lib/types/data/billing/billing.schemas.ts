import { z } from 'zod';
import { BIRTH_SEXES, SUBSCRIBER_RELATIONSHIPS } from '../../../fhir/constants';
import { INSURANCE_CANDID_PLAN_TYPE_CODES } from '../../../fhir/insurance';
import { isCLIAValid, isNPIValidWithChecksum } from '../../../helpers/helpers';
import {
  CMS_PLACE_OF_SERVICE_CODE_SET,
  CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES,
  CODE_SYSTEM_SERVICE_CATEGORY_CODE_NAMES,
} from '../../../helpers/rcm/constants';
import { taxIdRegex, zipRegex } from '../../../validation';
import { STATE_CODES } from '../../common';
import {
  CLAIM_STATUS_FIELD_KEYS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusFieldKey,
  isValidClaimStatusValue,
} from './claim-status';

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
  claimId: z.string().uuid(),
});

export const GetClaimHistoryInputSchema = z.object({
  claimId: nonEmptyString.uuid(),
});

export const ExportClaimX12InputSchema = z.object({
  claimId: z.string().uuid(),
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
  claimId: z.string().uuid(),
  action: z.enum(['add', 'remove']),
  tagName: nonEmptyString,
});

// Set (or clear, when value is null/empty) one claim-status meta.tag.
export const SetClaimStatusInputSchema = z
  .object({
    claimId: z.string().uuid(),
    field: z.enum(CLAIM_STATUS_FIELD_KEYS),
    value: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // A provided value must be one of the field's allowed options (empty/null clears it).
    if (!isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY[data.field], data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `Invalid value "${data.value}" for claim status field "${data.field}"`,
      });
    }
  });

export const MAX_SUBMIT_BILLING_CLAIMS = 20;

export const SubmitBillingClaimsInputSchema = z.object({
  claimIds: z.array(z.string().uuid()).min(1).max(MAX_SUBMIT_BILLING_CLAIMS),
});

// Status indicators keyed by ClaimStatusFieldKey; unknown keys are rejected and each provided value
// must be a valid option for its field.
export const claimStatusesSchema = z
  .record(z.enum(CLAIM_STATUS_FIELD_KEYS), z.string())
  .superRefine((statuses, ctx) => {
    for (const [key, value] of Object.entries(statuses)) {
      if (!isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY[key as ClaimStatusFieldKey], value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Invalid value "${value}" for claim status field "${key}"`,
        });
      }
    }
  });

export const GetPatientDetailInputSchema = z.object({
  patientId: nonEmptyString,
});

export const GetPatientCoveragesInputSchema = z.object({
  patientId: nonEmptyString,
});

export const SearchBillingClaimsInputSchema = z.object({
  searchText: nonEmptyString.optional(),
  type: z.enum(CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES).optional(),
  status: nonEmptyString.optional(),
  arStage: nonEmptyString.optional(),
  tag: nonEmptyString.optional(),
  createdFrom: nonEmptyString.optional(),
  createdTo: nonEmptyString.optional(),
  payerName: nonEmptyString.optional(),
  payerId: nonEmptyString.optional(),
  service: nonEmptyString.optional(),
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
});

export const SearchBillingPatientsInputSchema = z.object({
  name: nonEmptyString.optional(),
  dob: nonEmptyString.optional(),
  identifier: nonEmptyString.optional(),
  uuid: z.string().uuid().optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SearchBillingLocationsInputSchema = z.object({
  name: nonEmptyString.optional(),
});

export const SearchBillingServicesInputSchema = z.object({
  name: nonEmptyString.optional(),
});

export const SearchBillingPayersInputSchema = z.object({
  name: nonEmptyString.optional(),
});

const claimDiagnosisSchema = z.object({
  code: nonEmptyString,
  display: z.string().optional(),
});

const claimServiceLineSchema = z.object({
  cptCode: nonEmptyString,
  units: z.number().positive(),
  charges: z.number(),
  serviceDate: nonEmptyString,
  placeOfService: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  // 1-based references into the claim's diagnosis list (FHIR item.diagnosisSequence)
  diagnosisPointers: z.array(z.number().int().positive()).optional(),
});

export const SearchServiceFacilitiesInputSchema = z.object({
  facilityId: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  offset: nonNegativeInt.optional(),
  pageSize: nonNegativeInt.optional(),
});

export const SaveServiceFacilityInputSchema = z.object({
  facilityId: nonEmptyString.optional(),
  name: nonEmptyString,
  addressLine1: nonEmptyString,
  addressLine2: z.string().trim().optional(),
  city: nonEmptyString,
  state: nonEmptyString.refine((code) => STATE_CODES.has(code), 'Unknown state code'),
  zip: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'ZIP must be 9 digits'),
  npi: z
    .string()
    .trim()
    .refine(isNPIValidWithChecksum, 'NPI must be 10 digits with a valid check digit')
    .nullable()
    .optional(),
  clia: z
    .string()
    .trim()
    .refine(isCLIAValid, 'CLIA must match the format NNDNNNNNNN, e.g. 05D1234567')
    .nullable()
    .optional(),
  posCode: z
    .string()
    .refine((code) => CMS_PLACE_OF_SERVICE_CODE_SET.has(code), 'Unknown place of service code')
    .nullable()
    .optional(),
});

export const DeleteServiceFacilityInputSchema = z.object({
  facilityId: nonEmptyString,
});

// Create assembles a claim from existing resources by reference only. Tweaking a referenced
// resource's details (names, NPIs, addresses, etc.) is done afterward via the claim editing UI,
// so this input carries no override fields.
export const CreateBillingClaimInputSchema = z.object({
  patientId: nonEmptyString,
  coverageId: nonEmptyString.optional(),
  renderingProvider: z
    .object({
      id: nonEmptyString,
      type: z.enum(['Practitioner', 'Organization']),
    })
    .optional(),
  facilityId: nonEmptyString.optional(),
  billingProvider: z
    .object({
      id: nonEmptyString,
      type: z.enum(['Practitioner', 'Organization']),
    })
    .optional(),
  diagnoses: z.array(claimDiagnosisSchema).optional(),
  serviceLines: z.array(claimServiceLineSchema).optional(),
  // Initial claim status indicators; AR Stage's progress status is auto-initialized server-side.
  statuses: claimStatusesSchema.optional(),
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

const billingNpiSchema = nonEmptyString.refine(
  isNPIValidWithChecksum,
  'NPI must be a valid 10-digit number with a correct check digit'
);
const billingTaxIdSchema = nonEmptyString.regex(taxIdRegex, 'Tax ID / EIN must be exactly 9 digits');
const billingTaxonomyCodeSchema = z.string().trim().length(10, 'Taxonomy code must be exactly 10 characters');
// Providers require a validated ZIP (5-digit or ZIP+4); the base address schema stays loose
// because patient working copies carry addresses cloned from clinical data.
const billingProviderAddressSchema = billingAddressSchema.extend({
  postalCode: nonEmptyString
    .regex(zipRegex, 'ZIP code must be 5 digits, optionally with a 4-digit extension')
    .optional(),
});

export const CreateBillingProviderInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('individual'),
    firstName: nonEmptyString,
    lastName: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: billingNpiSchema.optional(),
    taxonomyCode: billingTaxonomyCodeSchema.optional(),
    licenseType: nonEmptyString.optional(),
    taxId: billingTaxIdSchema.optional(),
    address: billingProviderAddressSchema.optional(),
  }),
  z.object({
    kind: z.literal('organization'),
    name: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: billingNpiSchema.optional(),
    taxonomyCode: billingTaxonomyCodeSchema.optional(),
    taxId: billingTaxIdSchema.optional(),
    address: billingProviderAddressSchema.optional(),
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
    npi: billingNpiSchema.optional(),
    taxonomyCode: billingTaxonomyCodeSchema.optional(),
    licenseType: nonEmptyString.optional(),
    taxId: billingTaxIdSchema.optional(),
    address: billingProviderAddressSchema.optional(),
  }),
  z.object({
    kind: z.literal('organization'),
    providerId: nonEmptyString,
    name: nonEmptyString,
    roles: z.array(billingProviderRole).min(1),
    npi: billingNpiSchema.optional(),
    taxonomyCode: billingTaxonomyCodeSchema.optional(),
    taxId: billingTaxIdSchema.optional(),
    address: billingProviderAddressSchema.optional(),
  }),
]);

export const DeleteBillingProviderInputSchema = z.object({
  providerId: nonEmptyString,
  kind: z.enum(['individual', 'organization']),
});

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

// --- Coverage (insurance) CRUD ---

const subscriberRelationshipSchema = z.enum(SUBSCRIBER_RELATIONSHIPS);

const insuranceTypeSchema = z.enum(['primary', 'secondary', 'workersComp']);

const billingPolicyHolderSchema = z.object({
  firstName: nonEmptyString,
  middleName: z.string().optional(),
  lastName: nonEmptyString,
  dob: nonEmptyString,
  birthSex: z.enum(BIRTH_SEXES),
  address: billingAddressSchema.optional(),
});

export const CreateBillingCoverageInputSchema = z
  .object({
    patientId: nonEmptyString,
    payerId: nonEmptyString,
    memberId: nonEmptyString,
    insuranceType: insuranceTypeSchema,
    planType: nonEmptyString.optional(),
    relationship: subscriberRelationshipSchema,
    policyHolder: billingPolicyHolderSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.relationship !== 'Self' && !data.policyHolder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policyHolder'],
        message: 'Policy holder details are required when the relationship to insured is not "Self"',
      });
    }
  });

export const UpdateBillingCoverageInputSchema = z
  .object({
    coverageId: nonEmptyString,
    payerId: nonEmptyString.optional(),
    memberId: nonEmptyString.optional(),
    insuranceType: insuranceTypeSchema.optional(),
    planType: nonEmptyString.optional(),
    relationship: subscriberRelationshipSchema.optional(),
    policyHolder: billingPolicyHolderSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.relationship && data.relationship !== 'Self' && !data.policyHolder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policyHolder'],
        message: 'Policy holder details are required when the relationship to insured is not "Self"',
      });
    }
  });

export const DeleteBillingCoverageInputSchema = z.object({
  coverageId: nonEmptyString,
});

export const CreateBillingWorkingCopyInputSchema = z.object({
  resourceType: z.enum(ALLOWED_BILLING_RESOURCE_TYPES),
  resourceId: nonEmptyString,
  overrides: z.record(z.unknown()).optional(),
});

export const CreateBillingClaimFromEncounterInputSchema = z.object({
  encounterId: z.string().uuid(),
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

const updateBillingResourceUnion = z.discriminatedUnion('resourceType', [
  z.object({
    resourceType: z.literal('Patient'),
    resourceId: nonEmptyString,
    claimId: nonEmptyString.uuid(),
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
    claimId: nonEmptyString.uuid(),
    fields: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      npi: z.string().optional(),
      taxId: z.string().optional(),
      taxonomyCode: z.string().optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Coverage'),
    resourceId: nonEmptyString,
    claimId: nonEmptyString.uuid(),
    fields: z.object({
      subscriberId: z.string().optional(),
      status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']).optional(),
      relationship: subscriberRelationshipSchema.optional(),
      policyHolder: billingPolicyHolderSchema.optional(),
    }),
  }),
  z.object({
    resourceType: z.literal('Location'),
    resourceId: nonEmptyString,
    claimId: nonEmptyString.uuid(),
    fields: z.object({
      name: z.string().optional(),
      npi: z.string().optional(),
      address: updatableAddressSchema,
    }),
  }),
  z.object({
    resourceType: z.literal('Organization'),
    resourceId: nonEmptyString,
    claimId: nonEmptyString.uuid(),
    fields: z.object({
      name: z.string().optional(),
      npi: z.string().optional(),
      taxId: z.string().optional(),
      taxonomyCode: z.string().optional(),
    }),
  }),
  // Attach working copies for resources the claim was created without, re-point the payer (RCM payer id),
  // or replace the diagnosis / service line sets.
  z.object({
    resourceType: z.literal('Claim'),
    resourceId: nonEmptyString,
    claimId: nonEmptyString.uuid(),
    fields: z.object({
      type: z.enum(CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES).optional(),
      service: z.enum(CODE_SYSTEM_SERVICE_CATEGORY_CODE_NAMES).optional(),
      // Claim-level date of service; written to every service line by update-billing-claim.
      serviceDate: nonEmptyString.optional(),
      billingProvider: claimProviderRefSchema.optional(),
      renderingProvider: claimProviderRefSchema.optional(),
      facilityId: nonEmptyString.optional(),
      coverageId: nonEmptyString.optional(),
      removeCoverage: z.boolean().optional(),
      payerId: nonEmptyString.optional(),
      planType: z
        .string()
        .refine((code) => INSURANCE_CANDID_PLAN_TYPE_CODES.includes(code), 'Invalid plan type')
        .optional(),
      diagnoses: z.array(claimDiagnosisSchema).optional(),
      serviceLines: z.array(claimServiceLineSchema).optional(),
    }),
  }),
]);

export const UpdateBillingResourceInputSchema = updateBillingResourceUnion.superRefine((data, ctx) => {
  // Match update-billing-coverage: a non-self relationship requires policy-holder details.
  if (
    data.resourceType === 'Coverage' &&
    data.fields.relationship &&
    data.fields.relationship !== 'Self' &&
    !data.fields.policyHolder
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fields', 'policyHolder'],
      message: 'Policy holder details are required when the relationship to insured is not "Self"',
    });
  }
});

export const SearchChargeItemDefinitionsInputSchema = z.object({
  type: z.enum(['charge-master', 'fee-schedule']),
  name: nonEmptyString.optional(),
  offset: nonNegativeInt.default(0),
  pageSize: nonNegativeInt.default(25),
});

export const CreateChargeItemDefinitionInputSchema = z.object({
  type: z.enum(['charge-master', 'fee-schedule']),
  name: nonEmptyString,
  effectiveDate: nonEmptyString.optional(),
  description: nonEmptyString.optional(),
  default: z.enum(['insurance', 'self-pay']).optional(),
});

export const GetChargeItemDefinitionInputSchema = z.object({
  type: z.enum(['charge-master', 'fee-schedule']),
  chargeItemDefinitionId: nonEmptyString.uuid(),
});

export const UpdateChargeItemDefinitionInputSchema = z.object({
  type: z.enum(['charge-master', 'fee-schedule']),
  chargeItemDefinitionId: nonEmptyString.uuid(),
  name: nonEmptyString.optional(),
  status: z.enum(['active', 'retired']).optional(),
  effectiveDate: nonEmptyString.nullable().optional(),
  description: nonEmptyString.nullable().optional(),
  default: z.enum(['insurance', 'self-pay']).nullable().optional(),
  procedureCodes: z
    .array(
      z.object({
        code: nonEmptyString,
        description: nonEmptyString.optional(),
        modifier: nonEmptyString.optional(),
        amount: z.number().nonnegative(),
      })
    )
    .optional(),
});

export const DeleteChargeItemDefinitionInputSchema = z.object({
  type: z.enum(['charge-master', 'fee-schedule']),
  chargeItemDefinitionId: nonEmptyString.uuid(),
});

export const ImportEraInputSchema = z.object({
  era: nonEmptyString,
});

export type GetClaimDetailInput = z.output<typeof GetClaimDetailInputSchema>;
export type GetClaimHistoryInput = z.output<typeof GetClaimHistoryInputSchema>;
export type ExportClaimX12Input = z.output<typeof ExportClaimX12InputSchema>;
export type GetEraDetailInput = z.output<typeof GetEraDetailInputSchema>;
export type SearchErasInput = z.output<typeof SearchErasInputSchema>;
export type SaveBillingTagInput = z.output<typeof SaveBillingTagInputSchema>;
export type DeleteBillingTagInput = z.output<typeof DeleteBillingTagInputSchema>;
export type TagBillingClaimInput = z.output<typeof TagBillingClaimInputSchema>;
export type SetClaimStatusInput = z.output<typeof SetClaimStatusInputSchema>;
export type SubmitBillingClaimsInput = z.output<typeof SubmitBillingClaimsInputSchema>;
export type GetPatientDetailInput = z.output<typeof GetPatientDetailInputSchema>;
export type GetPatientCoveragesInput = z.output<typeof GetPatientCoveragesInputSchema>;
export type SearchBillingClaimsInput = z.output<typeof SearchBillingClaimsInputSchema>;
export type SearchBillingProvidersInput = z.output<typeof SearchBillingProvidersInputSchema>;
export type SearchBillingPatientsInput = z.output<typeof SearchBillingPatientsInputSchema>;
export type SearchBillingLocationsInput = z.output<typeof SearchBillingLocationsInputSchema>;
export type SearchBillingServicesInput = z.output<typeof SearchBillingServicesInputSchema>;
export type SearchBillingPayersInput = z.output<typeof SearchBillingPayersInputSchema>;
export type CreateBillingClaimInput = z.output<typeof CreateBillingClaimInputSchema>;
export type CreateBillingProviderInput = z.output<typeof CreateBillingProviderInputSchema>;
export type DeleteBillingProviderInput = z.output<typeof DeleteBillingProviderInputSchema>;
export type CreateBillingPatientInput = z.output<typeof CreateBillingPatientInputSchema>;
export type UpdateBillingPatientInput = z.output<typeof UpdateBillingPatientInputSchema>;
export type CreateBillingCoverageInput = z.output<typeof CreateBillingCoverageInputSchema>;
export type UpdateBillingCoverageInput = z.output<typeof UpdateBillingCoverageInputSchema>;
export type DeleteBillingCoverageInput = z.output<typeof DeleteBillingCoverageInputSchema>;
export type BillingSubscriberRelationship = z.output<typeof subscriberRelationshipSchema>;
export type BillingInsuranceType = z.output<typeof insuranceTypeSchema>;
export type BillingPolicyHolderInput = z.output<typeof billingPolicyHolderSchema>;
export type UpdateBillingProviderInput = z.output<typeof UpdateBillingProviderInputSchema>;
export type CreateBillingWorkingCopyInput = z.output<typeof CreateBillingWorkingCopyInputSchema>;
export type CreateBillingClaimFromEncounterInput = z.output<typeof CreateBillingClaimFromEncounterInputSchema>;
export type UpdateBillingResourceInput = z.output<typeof UpdateBillingResourceInputSchema>;
export type BillingResourceType = (typeof ALLOWED_BILLING_RESOURCE_TYPES)[number];
export type SearchChargeItemDefinitionsInput = z.output<typeof SearchChargeItemDefinitionsInputSchema>;
export type CreateChargeItemDefinitionInput = z.output<typeof CreateChargeItemDefinitionInputSchema>;
export type GetChargeItemDefinitionInput = z.output<typeof GetChargeItemDefinitionInputSchema>;
export type UpdateChargeItemDefinitionInput = z.output<typeof UpdateChargeItemDefinitionInputSchema>;
export type DeleteChargeItemDefinitionInput = z.output<typeof DeleteChargeItemDefinitionInputSchema>;
export type SearchServiceFacilitiesInput = z.output<typeof SearchServiceFacilitiesInputSchema>;
export type SaveServiceFacilityInput = z.output<typeof SaveServiceFacilityInputSchema>;
export type DeleteServiceFacilityInput = z.output<typeof DeleteServiceFacilityInputSchema>;
export type ImportEraInput = z.output<typeof ImportEraInputSchema>;

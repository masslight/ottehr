import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { DOSE_BASES } from 'utils/lib/helpers/medications/plain-dose';
import { prescriptionFrequency } from 'utils/lib/helpers/medications/prescription-suggestions';
import { isRepairDepthSelection, REPAIR_DEPTH_OPTIONS } from 'utils/lib/procedure-coding/format';
import { isStructuredFacts, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { isPlausibleLengthCm, MAX_PLAUSIBLE_LENGTH_CM } from 'utils/lib/procedure-coding/validation';
import { Secrets } from 'utils/lib/secrets';
import { QUANTITY_UNITS } from 'utils/lib/types/api/order-prescription.types';
import {
  PRESCRIPTION_ADDITIONAL_INSTRUCTIONS_MAX,
  PRESCRIPTION_SET_STATUSES,
} from 'utils/lib/types/api/quick-picks.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { assertDefined, createClinicalOystehrClient, validateJsonBody } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import {
  ALLERGY_QUICK_PICK_CATEGORY,
  IMMUNIZATION_QUICK_PICK_CATEGORY,
  IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY,
  INSURANCE_QUICK_PICK_CATEGORY,
  MEDICAL_CONDITION_QUICK_PICK_CATEGORY,
  MEDICATION_HISTORY_QUICK_PICK_CATEGORY,
  PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY,
  PRESCRIPTION_QUICK_PICK_CATEGORY,
  PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
  PROCEDURE_QUICK_PICK_CATEGORY,
  QUICK_TEXT_QUICK_PICK_CATEGORY,
  RADIOLOGY_QUICK_PICK_CATEGORY,
} from '../shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QuickPickCategory,
  quickPickToActivityDefinition,
  searchQuickPicks,
} from '../shared/quick-pick-helpers';

interface QuickPickCreateInputValidated {
  quickPick: any;
  category: string;
  secrets: Secrets;
}

interface CategoryConfig {
  category: QuickPickCategory<any>;
  requiredStringFields: string[];
  validator?: (oystehr: Oystehr, quickPick: Record<string, unknown>, quickPickId?: string) => Promise<void>;
}

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour HH:MM time');

const repairDepthSchema = z.string().refine(isRepairDepthSelection, {
  message: `must be one of: ${REPAIR_DEPTH_OPTIONS.map((option) => option.value).join(', ')}`,
});

const lengthCmSchema = z
  .number()
  .refine(isPlausibleLengthCm, { message: `must be greater than 0 and at most ${MAX_PLAUSIBLE_LENGTH_CM} cm` });

const cptCodeSchema = z.object({
  code: z.string(),
  display: z.string(),
  modifier: z.array(z.object({ code: z.string(), display: z.string() })).optional(),
  billableUnits: z.number().positive().optional(),
});

const procedureQuickPickSchema = z
  .object({
    cptCodes: z.array(cptCodeSchema).optional(),
    diagnoses: z.array(cptCodeSchema).optional(),
    structuredFacts: z.custom<StructuredFacts>(isStructuredFacts).optional(),
    lengthCm: lengthCmSchema.optional(),
    repairDepth: repairDepthSchema.optional(),
    infusionStartTime: clockTimeSchema.optional(),
    infusionStopTime: clockTimeSchema.optional(),
  })
  .passthrough();

// The calculator's settings, so the pick can be re-dosed by weight; a per-day rate and a per-day maximum need a count
// of doses a day: a scheduled frequency's, or an older quick pick's own doses a day (no longer saved).
const prescriptionDosingSchema = z
  .object({
    rate: z.number().positive(),
    basis: z.enum(DOSE_BASES),
    dosesPerDay: z.number().positive().optional(),
    frequency: z
      .string()
      .refine(
        (frequency) => prescriptionFrequency(frequency) !== undefined,
        'must be one of the order form frequencies'
      )
      .optional(),
    durationDays: z.number().int().min(1).max(999).optional(),
    maxPerDoseMg: z.number().positive().optional(),
    maxPerDayMg: z.number().positive().optional(),
  })
  .refine(
    (dosing) =>
      dosing.basis !== 'mg/kg/day' ||
      dosing.dosesPerDay !== undefined ||
      prescriptionFrequency(dosing.frequency)?.dosesPerDay !== undefined,
    { message: 'a mg/kg/day rate needs a frequency with a count of doses a day', path: ['frequency'] }
  )
  .refine(
    (dosing) =>
      dosing.maxPerDayMg === undefined ||
      dosing.dosesPerDay !== undefined ||
      prescriptionFrequency(dosing.frequency)?.dosesPerDay !== undefined,
    { message: 'maxPerDayMg needs dosesPerDay or a frequency with a count of doses a day', path: ['maxPerDayMg'] }
  );

// Where the pick's dosing is from, shown as a link: https only, so a saved link never opens anything else.
const prescriptionSourceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), 'must be an https link')
    .optional(),
});

// One ingredient of the product, as the medication search gives it: amoxicillin 80 MG per 1 ML.
const prescriptionIngredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number().nonnegative(),
  unit: z.string().trim().min(1).max(20),
  per: z.number().positive(),
  perUnit: z.string().trim().min(1).max(20),
});

// Same limits as the eRx order form, so a saved pick always fits the order endpoint.
const prescriptionQuickPickSchema = z
  .object({
    ndc: z
      .string()
      .regex(/^\d{11}$/, 'must be an 11-digit NDC')
      .optional(),
    medicationDescription: z.string().max(105).optional(),
    // The product's details from the medication search, kept so the order form needn't read its name.
    rxcui: z.string().regex(/^\d+$/, 'must be digits').optional(),
    doseForm: z.string().trim().min(1).max(100).optional(),
    ingredients: z.array(prescriptionIngredientSchema).min(1).max(20).optional(),
    quantityValue: z.number().positive().optional(),
    quantityUnit: z.enum(QUANTITY_UNITS).optional(),
    daysSupply: z.number().int().min(1).max(999).optional(),
    numberOfRefills: z.number().int().min(0).max(99).optional(),
    substitutionAllowed: z.boolean().optional(),
    patientInstructions: z.string().max(1000).optional(),
    noteToPharmacy: z.string().max(210).optional(),
    diagnosis: z.object({ code: z.string().min(1), display: z.string() }).optional(),
    dosing: prescriptionDosingSchema.optional(),
    additionalInstructions: z.string().max(PRESCRIPTION_ADDITIONAL_INSTRUCTIONS_MAX).optional(),
    source: prescriptionSourceSchema.optional(),
  })
  .passthrough();

// A set is its prescription quick picks in order; their dosing stays on them.
export const prescriptionSetQuickPickSchema = z
  .object({
    status: z.enum(PRESCRIPTION_SET_STATUSES),
    memberIds: z.array(z.string().trim().min(1)).min(1, 'must have at least one prescription quick pick'),
    removedMembers: z.array(z.object({ name: z.string(), removedAt: z.string().datetime() })).optional(),
  })
  .passthrough();

/** Names are unique within a category, trimmed and in any case; the quick pick being edited keeps its own. Existing
 * duplicates still load: only a create or an update is checked. */
const assertNameUnused = async <T extends { id?: string; name: string }>(
  oystehr: Oystehr,
  category: QuickPickCategory<T>,
  quickPick: Record<string, unknown>,
  quickPickId: string | undefined,
  label: string
): Promise<void> => {
  const name = String(quickPick.name).trim();
  const existing = await searchQuickPicks(oystehr, category);
  if (
    existing.some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase() && (quickPickId ? p.id !== quickPickId : true)
    )
  ) {
    throw INVALID_INPUT_ERROR(`${label} named "${name}" already exists`);
  }
};

const CATEGORIES: CategoryConfig[] = [
  { category: ALLERGY_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: IMMUNIZATION_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  {
    category: INSURANCE_QUICK_PICK_CATEGORY,
    requiredStringFields: ['name', 'payerId', 'organizationReference'],
    validator: async (oystehr, quickPick, quickPickId) => {
      // Optional metadata must be an array of { key, value } strings when provided.
      if (quickPick.metadata !== undefined) {
        const metadata = quickPick.metadata;
        const isValidMetadata =
          Array.isArray(metadata) &&
          metadata.every(
            (entry) =>
              entry != null &&
              typeof entry === 'object' &&
              typeof (entry as Record<string, unknown>).key === 'string' &&
              typeof (entry as Record<string, unknown>).value === 'string'
          );
        if (!isValidMetadata) {
          throw INVALID_INPUT_ERROR('quickPick.metadata must be an array of { key, value } strings when provided');
        }
      }

      // A quick pick's name is now an arbitrary label (multiple picks may reference the same payer),
      // so enforce uniqueness on the name rather than the payer reference.
      await assertNameUnused(oystehr, INSURANCE_QUICK_PICK_CATEGORY, quickPick, quickPickId, 'An insurance quick pick');
    },
  },
  { category: MEDICAL_CONDITION_QUICK_PICK_CATEGORY, requiredStringFields: ['display'] },
  { category: MEDICATION_HISTORY_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY, requiredStringFields: ['name', 'text'] },
  {
    category: PRESCRIPTION_QUICK_PICK_CATEGORY,
    // Every prescription quick pick orders a product, as written or dosed by the calculator.
    requiredStringFields: ['name', 'ndc', 'medicationDescription'],
    validator: async (oystehr, quickPick, quickPickId) => {
      safeValidate(prescriptionQuickPickSchema, quickPick);
      await assertNameUnused(oystehr, PRESCRIPTION_QUICK_PICK_CATEGORY, quickPick, quickPickId, 'A quick pick');
    },
  },
  {
    category: PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
    requiredStringFields: ['name'],
    validator: async (oystehr, quickPick, quickPickId) => {
      safeValidate(prescriptionSetQuickPickSchema, quickPick);
      await assertNameUnused(
        oystehr,
        PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
        quickPick,
        quickPickId,
        'A prescription set'
      );
    },
  },
  {
    category: PROCEDURE_QUICK_PICK_CATEGORY,
    requiredStringFields: ['name'],
    validator: async (_oystehr, quickPick) => {
      safeValidate(procedureQuickPickSchema, quickPick);
    },
  },
  {
    category: QUICK_TEXT_QUICK_PICK_CATEGORY,
    requiredStringFields: ['name', 'english'],
    validator: async (_oystehr, quickPick) => {
      if (quickPick.spanish !== undefined && typeof quickPick.spanish !== 'string') {
        throw INVALID_INPUT_ERROR('quickPick.spanish must be a string when provided');
      }
    },
  },
  { category: RADIOLOGY_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
];

export const CATEGORY_CONFIG_MAP: Record<string, CategoryConfig> = Object.fromEntries(
  CATEGORIES.map((c) => [c.category.tagCode, c])
);

let m2mToken: string;

export const index = wrapHandler(
  'admin-create-quick-pick',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, quickPick, category } = validateInput(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const config = CATEGORY_CONFIG_MAP[category];
    if (config.validator) {
      await config.validator(oystehr, quickPick);
    }

    const activityDefinition = await oystehr.fhir.create<ActivityDefinition>(
      quickPickToActivityDefinition(quickPick, config.category)
    );
    const created = activityDefinitionToQuickPick(activityDefinition, config.category);
    const displayName = config.category.getDisplayName(quickPick);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully created quick pick: ${displayName}`, quickPick: created }),
    };
  }
);

export function validateInput(input: ZambdaInput): QuickPickCreateInputValidated {
  const { quickPick, category } = validateJsonBody(input);
  const config = CATEGORY_CONFIG_MAP[category];
  if (!config) {
    throw INVALID_INPUT_ERROR(`Unknown quick pick category: ${category}`);
  }
  if (!quickPick || typeof quickPick !== 'object') {
    throw INVALID_INPUT_ERROR('quickPick must be an object');
  }
  const qp = quickPick as Record<string, unknown>;
  for (const field of config.requiredStringFields) {
    if (!qp[field] || typeof qp[field] !== 'string') {
      throw INVALID_INPUT_ERROR(`quickPick.${field} is required and must be a string`);
    }
  }
  return {
    quickPick,
    category,
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

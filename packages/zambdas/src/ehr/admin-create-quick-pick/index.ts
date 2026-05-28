import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, Secrets } from 'utils';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  ALLERGY_QUICK_PICK_CATEGORY,
  IMMUNIZATION_QUICK_PICK_CATEGORY,
  IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY,
  INSURANCE_QUICK_PICK_CATEGORY,
  MEDICAL_CONDITION_QUICK_PICK_CATEGORY,
  MEDICATION_HISTORY_QUICK_PICK_CATEGORY,
  PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY,
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

const CATEGORIES: CategoryConfig[] = [
  { category: ALLERGY_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: IMMUNIZATION_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  {
    category: INSURANCE_QUICK_PICK_CATEGORY,
    requiredStringFields: ['name', 'payerId', 'organizationReference'],
    validator: async (oystehr, quickPick, quickPickId) => {
      const existing = await searchQuickPicks(oystehr, INSURANCE_QUICK_PICK_CATEGORY);
      if (
        existing.some(
          (p) =>
            p.organizationReference === quickPick.organizationReference && (quickPickId ? p.id !== quickPickId : true)
        )
      ) {
        throw INVALID_INPUT_ERROR(`An insurance quick pick for ${quickPick.name} already exists`);
      }
    },
  },
  { category: MEDICAL_CONDITION_QUICK_PICK_CATEGORY, requiredStringFields: ['display'] },
  { category: MEDICATION_HISTORY_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
  { category: PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY, requiredStringFields: ['name', 'text'] },
  { category: PROCEDURE_QUICK_PICK_CATEGORY, requiredStringFields: ['name'] },
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
    const oystehr = createOystehrClient(m2mToken, secrets);

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

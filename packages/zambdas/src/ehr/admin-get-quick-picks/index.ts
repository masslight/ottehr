import { APIGatewayProxyResult } from 'aws-lambda';
import { INVALID_INPUT_ERROR, QuickPickListInput, Secrets } from 'utils';
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
import { QuickPickCategory, searchQuickPicks } from '../shared/quick-pick-helpers';

interface QuickPickListInputValidated extends QuickPickListInput {
  secrets: Secrets;
}

const CATEGORY_MAP: Record<string, QuickPickCategory<any>> = Object.fromEntries(
  [
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
  ].map((c) => [c.tagCode, c])
);

let m2mToken: string;

export const index = wrapHandler(
  'admin-get-quick-picks',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, category } = validateInput(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const quickPicks = await searchQuickPicks(oystehr, CATEGORY_MAP[category]);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Found ${quickPicks.length} quick picks`, quickPicks }),
    };
  }
);

export function validateInput(input: ZambdaInput): QuickPickListInputValidated {
  const { category } = validateJsonBody(input);
  const quickPickCategory = CATEGORY_MAP[category];
  if (!quickPickCategory) {
    throw INVALID_INPUT_ERROR(`Unknown quick pick category: ${category}`);
  }
  return {
    category,
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

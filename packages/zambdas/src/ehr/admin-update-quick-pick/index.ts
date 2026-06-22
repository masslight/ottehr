import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, Secrets } from 'utils';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { CATEGORY_CONFIG_MAP } from '../admin-create-quick-pick';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../shared/quick-pick-helpers';

interface QuickPickUpdateInputValidated {
  quickPickId: string;
  quickPick: any;
  category: string;
  secrets: Secrets;
}

let m2mToken: string;

export const index = wrapHandler(
  'admin-update-quick-pick',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, quickPickId, quickPick, category } = validateInput(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const config = CATEGORY_CONFIG_MAP[category];
    if (config.validator) {
      await config.validator(oystehr, quickPick, quickPickId);
    }

    const activityDefinition = await oystehr.fhir.update<ActivityDefinition>(
      quickPickToActivityDefinition(quickPick, config.category, quickPickId)
    );
    const updated = activityDefinitionToQuickPick(activityDefinition, config.category);
    const displayName = config.category.getDisplayName(quickPick);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully updated quick pick: ${displayName}`, quickPick: updated }),
    };
  }
);

export function validateInput(input: ZambdaInput): QuickPickUpdateInputValidated {
  const { quickPickId, quickPick, category } = validateJsonBody(input);
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
    quickPickId: validateString(quickPickId, 'quickPickId'),
    quickPick,
    category,
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

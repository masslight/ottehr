import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { QuickPickRemoveInput, Secrets, validateDefined } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { QUICK_PICK_TAG_SYSTEM } from '../shared/quick-pick-helpers';

interface QuickPickRemoveInputValidated extends QuickPickRemoveInput {
  secrets: Secrets;
}

let m2mToken: string;

export const index = wrapHandler(
  'admin-remove-quick-pick',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, quickPickId } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    await removeQuickPick(quickPickId, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully removed quick pick' }),
    };
  }
);

async function removeQuickPick(quickPickId: string, oystehr: Oystehr): Promise<void> {
  let existing: ActivityDefinition;
  try {
    existing = await oystehr.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: quickPickId,
    });
  } catch {
    throw new Error(`ActivityDefinition with id ${quickPickId} not found`);
  }
  const tags = existing.meta?.tag ?? [];
  const hasQuickPickTag = tags.some((t) => t.system === QUICK_PICK_TAG_SYSTEM);
  if (!hasQuickPickTag) {
    throw new Error(`ActivityDefinition ${quickPickId} is not a quick pick resource`);
  }
  existing.status = 'retired';
  await oystehr.fhir.update(existing);
}

export function validateRequestParameters(input: ZambdaInput): QuickPickRemoveInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const body = validateJsonBody(input);
  return {
    quickPickId: validateString(body.quickPickId, 'quickPickId'),
    secrets: validateDefined(input.secrets, 'input.secrets'),
  };
}

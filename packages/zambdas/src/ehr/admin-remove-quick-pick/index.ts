import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { QuickPickRemoveInput } from 'utils/lib/types/api/quick-picks.types';
import { Secrets } from 'utils/lib/secrets';
import { validateDefined } from 'utils/lib/helpers/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody, validateString } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
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
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
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

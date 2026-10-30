import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { validateDefined } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { QuickPickRemoveInput } from 'utils/lib/types/api/quick-picks.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody, validateString } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  PRESCRIPTION_QUICK_PICK_CATEGORY,
  PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
} from '../shared/quick-pick-categories';
import { QUICK_PICK_TAG_SYSTEM, quickPickToActivityDefinition, searchQuickPicks } from '../shared/quick-pick-helpers';

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

export async function removeQuickPick(quickPickId: string, oystehr: Oystehr): Promise<void> {
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
  if (tags.some((t) => t.system === QUICK_PICK_TAG_SYSTEM && t.code === PRESCRIPTION_QUICK_PICK_CATEGORY.tagCode)) {
    await takeOutOfPrescriptionSets(oystehr, quickPickId, existing.title ?? existing.name ?? '');
  }
}

/** A removed prescription quick pick leaves every set that has it; those sets turn Inactive, noting the removal,
 * until someone reviews and saves them. */
export async function takeOutOfPrescriptionSets(
  oystehr: Oystehr,
  quickPickId: string,
  name: string,
  removedAt = new Date().toISOString()
): Promise<void> {
  const sets = await searchQuickPicks(oystehr, PRESCRIPTION_SET_QUICK_PICK_CATEGORY);
  await Promise.all(
    sets
      .filter((set) => set.memberIds.includes(quickPickId))
      .map(({ id, ...set }) =>
        oystehr.fhir.update(
          quickPickToActivityDefinition(
            {
              ...set,
              status: 'Inactive',
              memberIds: set.memberIds.filter((memberId) => memberId !== quickPickId),
              removedMembers: [...(set.removedMembers ?? []), { name, removedAt }],
            },
            PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
            id
          )
        )
      )
  );
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

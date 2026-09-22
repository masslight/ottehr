import {
  CreateBillingClaimFromEncounterInput,
  CreateBillingClaimFromEncounterInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { safeValidate } from '../../../shared/validation';
import { TaskSubscriptionInput } from '../validateRequestParameters';

export interface BillingClaimTaskParams extends CreateBillingClaimFromEncounterInput {
  secrets: TaskSubscriptionInput['secrets'];
}

export function validateRequestParameters(input: TaskSubscriptionInput): BillingClaimTaskParams {
  const [resourceType, encounterId, ...rest] = input.task.encounter?.reference?.split('/') ?? [];
  if (resourceType !== 'Encounter' || rest.length) throw INVALID_INPUT_ERROR('Task must reference an Encounter');

  const data = safeValidate(CreateBillingClaimFromEncounterInputSchema, { encounterId });
  return { ...data, secrets: input.secrets };
}

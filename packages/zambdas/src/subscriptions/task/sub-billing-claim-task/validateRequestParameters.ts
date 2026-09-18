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
  const reference = input.task.encounter?.reference;
  if (!reference?.startsWith('Encounter/')) throw INVALID_INPUT_ERROR('Task must reference an Encounter');

  const data = safeValidate(CreateBillingClaimFromEncounterInputSchema, {
    encounterId: reference.slice('Encounter/'.length),
  });
  return { ...data, secrets: input.secrets };
}

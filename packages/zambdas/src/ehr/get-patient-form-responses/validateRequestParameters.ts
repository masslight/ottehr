import { Secrets } from 'utils/lib/secrets';
import {
  GetPatientFormResponsesInput,
  TaggedFormPlacement,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { ZambdaInput } from '../../shared/types/common';

const TAGGED_PLACEMENTS: TaggedFormPlacement[] = ['screening', 'questionnaires'];

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientFormResponsesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let params: Partial<GetPatientFormResponsesInput>;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { patientId, placements } = params;

  if (typeof patientId !== 'string' || !isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('patientId must be a valid uuid');
  }
  if (
    !Array.isArray(placements) ||
    placements.length === 0 ||
    !placements.every((p): p is TaggedFormPlacement => TAGGED_PLACEMENTS.includes(p as TaggedFormPlacement))
  ) {
    throw INVALID_INPUT_ERROR(`placements must be a non-empty list of ${TAGGED_PLACEMENTS.join(', ')}`);
  }

  return { patientId, placements, secrets: input.secrets };
}

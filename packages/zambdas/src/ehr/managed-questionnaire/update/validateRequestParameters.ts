import {
  INVALID_INPUT_ERROR,
  ManagedQuestionnaireSchema,
  ManagedQuestionnaireUpdateInput,
  ManagedQuestionnaireUpdateStatusSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & ManagedQuestionnaireUpdateInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: ManagedQuestionnaireUpdateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { updateType, data } = params;

  const missingParams: string[] = [];

  if (!updateType) missingParams.push('updateType');
  if (!data) missingParams.push('data');
  if (missingParams.length > 0) throw MISSING_REQUIRED_PARAMETERS(missingParams);

  if (updateType === 'update-status') {
    const parsed = data;
    const validatedData = safeValidate(ManagedQuestionnaireUpdateStatusSchema, parsed);

    return {
      updateType,
      data: validatedData,
      secrets,
    };
  } else if (updateType === 'update-questionnaire') {
    const parsed = data;
    const validatedData = safeValidate(ManagedQuestionnaireSchema, parsed);

    if (!validatedData.id) {
      throw INVALID_INPUT_ERROR(`id is missing from the parsed questionnaire`);
    }

    return {
      updateType,
      data: validatedData,
      secrets,
    };
  }

  throw INVALID_INPUT_ERROR(`updateType was an unexpected value: ${updateType}`);
}

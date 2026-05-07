import {
  AdminUpdateLabSetInput,
  AdminUpdateLabSetStatus,
  INVALID_INPUT_ERROR,
  isValidUUID,
  LabSetDTO,
  LabSetDTOSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../../shared';

type BaseContext = {
  secrets: Secrets | null;
  userToken: string;
};

type ValidatedRequest = BaseContext & (AdminUpdateLabSetStatus | { updateType: 'edit'; data: LabSetDTO });

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminUpdateLabSetInput;
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

  if (updateType === 'edit') {
    const dataValidated = LabSetDTOSchema.safeParse(data);
    if (!dataValidated.success) {
      console.error(
        'Hit validation error during zod parsing. Tried to parse this json:',
        JSON.stringify(dataValidated.error.errors),
        JSON.stringify(dataValidated)
      );
      throw INVALID_INPUT_ERROR(`Validation failed for labSetFormInput: ${JSON.stringify(dataValidated.error.errors)}`);
    }

    return {
      updateType,
      data: dataValidated.data,
      secrets,
      userToken,
    };
  }

  if (updateType === 'toggle-status') {
    const validatedLabSetId = data.labSetId;

    if (!isValidUUID(validatedLabSetId)) {
      throw INVALID_INPUT_ERROR(`labSetId must be a valid uuid, id passed: ${validatedLabSetId}`);
    }
    return {
      updateType,
      data: {
        labSetId: validatedLabSetId,
      },
      secrets,
      userToken,
    };
  }

  throw INVALID_INPUT_ERROR(`updateType was an unexpected value: ${updateType}`);
}

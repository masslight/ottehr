import {
  AddClaimNoteInput,
  AddClaimNoteInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  NOT_AUTHORIZED,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface AddClaimNoteParams extends AddClaimNoteInput {
  secrets: ZambdaInput['secrets'];
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): AddClaimNoteParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.headers.Authorization) throw NOT_AUTHORIZED;

  const data = safeValidate(AddClaimNoteInputSchema, validateJsonBody(input));
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    ...data,
    secrets: input.secrets,
    userToken,
  };
}

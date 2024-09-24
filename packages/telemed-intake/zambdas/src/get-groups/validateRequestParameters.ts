import { ZambdaInput } from 'ottehr-utils';
import { GetGroupsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetGroupsInput {
  return {
    secrets: input.secrets,
  };
}

import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';

export interface TeamChatAccessInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): TeamChatAccessInput {
  return {
    secrets: input.secrets,
  };
}

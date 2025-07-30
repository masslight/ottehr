import { UserActivationZambdaInputSchema } from 'utils/lib/types/api/user-activation.types';
import { ZambdaInput } from '../../shared';
import { UserActivationZambdaInputValidated } from './index';

export function validateRequestParameters(input: ZambdaInput): UserActivationZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { mode, userId } = UserActivationZambdaInputSchema.parse(parsedJSON);
  console.log('parsed userId: ', JSON.stringify(userId));
  console.log('parsed mode: ', JSON.stringify(mode));

  return {
    userId,
    mode,
    secrets: input.secrets,
  };
}

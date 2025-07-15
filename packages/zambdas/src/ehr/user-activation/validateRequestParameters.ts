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
  const { mode, user } = UserActivationZambdaInputSchema.parse(parsedJSON);
  console.log('parsed user: ', JSON.stringify(user));
  console.log('parsed mode: ', JSON.stringify(mode));

  return {
    user,
    mode,
    secrets: input.secrets,
  };
}

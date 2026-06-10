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
  const { userActivationMode, userId } = UserActivationZambdaInputSchema.parse(parsedJSON);
  console.log('parsed userId: ', JSON.stringify(userId));
  console.log('parsed userActivationMode: ', JSON.stringify(userActivationMode));

  return {
    userId,
    userActivationMode,
    secrets: input.secrets,
  };
}

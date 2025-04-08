import { NOT_AUTHORIZED, PaymentMethodSetupParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodSetupParameters & { secrets: Secrets | null } & { authorization: any } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { beneficiaryPatientId } = JSON.parse(input.body);

  if (!beneficiaryPatientId) {
    throw new Error('beneficiaryPatientId is not defined');
  }

  return {
    beneficiaryPatientId,
    secrets: input.secrets,
    authorization,
  };
}

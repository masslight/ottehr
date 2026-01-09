import { isValidUUID, NOT_AUTHORIZED, PaymentMethodListParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodListParameters & { secrets: Secrets | null } & { authorization: any } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { beneficiaryPatientId, appointmentId } = JSON.parse(input.body);

  if (!beneficiaryPatientId) {
    throw new Error('beneficiaryPatientId is not defined');
  }

  if (!isValidUUID(beneficiaryPatientId)) {
    throw new Error('beneficiaryPatientId is not a valid UUID');
  }

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  if (!isValidUUID(appointmentId)) {
    throw new Error('appointmentId is not a valid UUID');
  }

  return {
    beneficiaryPatientId,
    appointmentId,
    secrets: input.secrets,
    authorization,
  };
}

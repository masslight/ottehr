import { GetTelemedAppointmentsRequest } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(
  input: ZambdaInput
): GetTelemedAppointmentsRequest & Pick<ZambdaInput, 'secrets'> {
  const { patientId } = input.body ? JSON.parse(input.body) : { patientId: undefined };

  return {
    patientId,
    secrets: input.secrets,
  };
}

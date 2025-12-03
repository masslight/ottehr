import {
  GetPatientAndResponsiblePartyInfoEndpointInput,
  GetPatientAndResponsiblePartyInfoEndpointInputSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientAndResponsiblePartyInfoEndpointInput & Pick<ZambdaInput, 'secrets'> {
  console.log(`input: ${JSON.stringify(input)}`);
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { patientId } = GetPatientAndResponsiblePartyInfoEndpointInputSchema.parse(parsedJSON);

  return {
    patientId,
    secrets: input.secrets,
  };
}

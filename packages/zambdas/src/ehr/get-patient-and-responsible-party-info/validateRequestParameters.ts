import {
  GetPatientAndResponsiblePartyInfoEndpointInput,
  GetPatientAndResponsiblePartyInfoEndpointInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientAndResponsiblePartyInfoEndpointInput & Pick<ZambdaInput, 'secrets'> {
  console.log(`input: ${JSON.stringify(input)}`);
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (input.secrets == null) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = JSON.parse(input.body);
  const { patientId } = GetPatientAndResponsiblePartyInfoEndpointInputSchema.parse(parsedJSON);

  return {
    patientId,
    secrets: input.secrets,
  };
}

import { CPTCodeDTO, DiagnosisDTO } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): { diagnoses: DiagnosisDTO[] | undefined; billing: CPTCodeDTO[] | undefined } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { diagnoses, billing } = JSON.parse(input.body);

  return {
    diagnoses,
    billing,
    secrets: input.secrets,
  };
}

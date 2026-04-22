import { ZambdaInput } from '../../shared';

export interface ExportPatientRecordInput {
  patientId: string;
}

export function validateRequestParameters(input: ZambdaInput): ExportPatientRecordInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId } = JSON.parse(input.body);

  if (!patientId) {
    throw new Error('patientId is required');
  }

  return { patientId, secrets: input.secrets };
}

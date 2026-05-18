import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface ExportPatientRecordInput {
  patientId: string;
}

export function validateRequestParameters(input: ZambdaInput): ExportPatientRecordInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  return { patientId, secrets: input.secrets };
}

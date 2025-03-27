import {} from 'utils';
import { GetPatientsInput } from '.';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  if (!input.body) {
    return { secrets: input.secrets };
  } else {
    const { patientID, dateRange } = JSON.parse(input.body);
    return {
      patientID,
      dateRange,
      secrets: input.secrets,
    };
  }
}

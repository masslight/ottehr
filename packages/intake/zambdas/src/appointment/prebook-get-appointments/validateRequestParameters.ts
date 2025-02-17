import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { GetPatientsInput } from '.';

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

import { ProcedureDetail } from 'utils';
import { safeJsonParse, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): ProcedureDetail & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // no complication
  const {
    procedureType,
    diagnoses,
    medicationUsed,
    bodySite,
    bodySide,
    technique,
    suppliesUsed,
    procedureDetails,
    timeSpent,
  } = safeJsonParse(input.body);

  return {
    procedureType,
    diagnoses,
    medicationUsed,
    bodySite,
    bodySide,
    technique,
    suppliesUsed,
    procedureDetails,
    timeSpent,
    secrets: input.secrets,
  };
}

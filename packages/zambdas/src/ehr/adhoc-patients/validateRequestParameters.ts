import {
  AdHocPatientsInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocPatientsInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    dateRange,
    includeAllergies,
    includeProblems,
    includeMedications,
    includeSurgicalHistory,
    includeHospitalizations,
  } = JSON.parse(input.body);

  if (!dateRange || typeof dateRange.start !== 'string' || typeof dateRange.end !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['dateRange']);
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return {
    dateRange,
    includeAllergies: includeAllergies === true,
    includeProblems: includeProblems === true,
    includeMedications: includeMedications === true,
    includeSurgicalHistory: includeSurgicalHistory === true,
    includeHospitalizations: includeHospitalizations === true,
    secrets: input.secrets,
  };
}

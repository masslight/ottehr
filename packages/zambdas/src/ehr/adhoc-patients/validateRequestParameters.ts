import { AdHocPatientsInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocPatientsInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('Missing request body');
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
    throw new Error('dateRange { start, end } is required');
  }

  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
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

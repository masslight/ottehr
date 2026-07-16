import {
  AdHocEncountersInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): AdHocEncountersInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    dateRange,
    includeCodes,
    includeTiming,
    includeAi,
    includeMedications,
    includeVitals,
    includeLabs,
    includeImaging,
    includeImmunizations,
    includeDisposition,
    includeExamRos,
    includeResults,
    includeNursing,
    includeIntake,
    includeDocuments,
  } = JSON.parse(input.body);

  if (!dateRange || typeof dateRange.start !== 'string' || typeof dateRange.end !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['dateRange']);
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return {
    dateRange,
    includeCodes: includeCodes === true,
    includeTiming: includeTiming === true,
    includeAi: includeAi === true,
    includeMedications: includeMedications === true,
    includeVitals: includeVitals === true,
    includeLabs: includeLabs === true,
    includeImaging: includeImaging === true,
    includeImmunizations: includeImmunizations === true,
    includeDisposition: includeDisposition === true,
    includeExamRos: includeExamRos === true,
    includeResults: includeResults === true,
    includeNursing: includeNursing === true,
    includeIntake: includeIntake === true,
    includeDocuments: includeDocuments === true,
    secrets: input.secrets,
  };
}

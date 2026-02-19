import { MakeMedicationHistoryPdfZambdaInput, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): MakeMedicationHistoryPdfZambdaInput & { secrets: any } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patient, appointment, medicationHistory, encounter, location } = JSON.parse(input.body);

  const missingResources = [];
  if (!patient) missingResources.push('patient');
  if (!appointment) missingResources.push('appointment');
  if (!medicationHistory) missingResources.push('medicationHistory');
  if (!encounter) missingResources.push('encounter');

  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return { patient, appointment, medicationHistory, encounter, location, secrets: input.secrets };
}

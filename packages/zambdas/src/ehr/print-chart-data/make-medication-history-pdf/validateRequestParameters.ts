import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { MakeMedicationHistoryPdfZambdaInput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): MakeMedicationHistoryPdfZambdaInput & { secrets: any } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patient, appointment, medicationHistory, encounter, location, timezone } = safeJsonParse(input.body);

  const missingResources = [];
  if (!patient) missingResources.push('patient');
  if (!appointment) missingResources.push('appointment');
  if (!medicationHistory) missingResources.push('medicationHistory');
  if (!encounter) missingResources.push('encounter');

  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return { patient, appointment, medicationHistory, encounter, location, timezone, secrets: input.secrets };
}

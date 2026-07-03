import { INVALID_INPUT_ERROR, SaveAdHocReportInput, SaveAdHocReportInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

// The whole definition is persisted into a single FHIR Basic resource. Generated code is a few KB
// (request/name/description are smaller still), so 256 KB is far above any legitimate report while
// still rejecting a runaway payload here with a clear message instead of an opaque FHIR write error.
// Measured over the serialized definition so no single large field can slip past.
const MAX_DEFINITION_LENGTH = 256 * 1024;

export function validateRequestParameters(input: ZambdaInput): SaveAdHocReportInput & { secrets: Secrets } {
  const parsed = validateWithSchema(SaveAdHocReportInputSchema, input);

  if (JSON.stringify(parsed.definition).length > MAX_DEFINITION_LENGTH) {
    throw INVALID_INPUT_ERROR(
      `report definition is too large to save (over ${Math.floor(MAX_DEFINITION_LENGTH / 1024)} KB)`
    );
  }

  return parsed;
}

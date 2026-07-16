import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  SaveAdHocReportInput,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

// The whole definition is persisted into a single FHIR Basic resource. Generated report code runs a
// few KB (request/name/description are smaller still), so 256 KB is far above any legitimate report
// while still rejecting a runaway payload here with a clear message instead of an opaque FHIR write
// error. Measured over the serialized definition so no single large field can slip past.
const MAX_DEFINITION_LENGTH = 256 * 1024;

export function validateRequestParameters(input: ZambdaInput): SaveAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { reportId, definition } = JSON.parse(input.body);

  if (!definition || typeof definition !== 'object') {
    throw MISSING_REQUIRED_PARAMETERS(['definition']);
  }
  if (typeof definition.name !== 'string' || definition.name.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['definition.name']);
  }
  if (typeof definition.datasetId !== 'string' || definition.datasetId.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['definition.datasetId']);
  }
  if (typeof definition.code !== 'string' || definition.code.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['definition.code']);
  }
  if (
    !definition.criteria ||
    typeof definition.criteria !== 'object' ||
    typeof definition.criteria.dateRange !== 'string'
  ) {
    throw MISSING_REQUIRED_PARAMETERS(['definition.criteria.dateRange']);
  }
  if (reportId !== undefined && typeof reportId !== 'string') {
    throw INVALID_INPUT_ERROR('reportId must be a string');
  }
  if (JSON.stringify(definition).length > MAX_DEFINITION_LENGTH) {
    throw INVALID_INPUT_ERROR(
      `report definition is too large to save (over ${Math.floor(MAX_DEFINITION_LENGTH / 1024)} KB)`
    );
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return { reportId, definition, secrets: input.secrets };
}

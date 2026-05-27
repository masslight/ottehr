import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PatientEducationSection,
  SavePatientEducationPdfInput,
} from 'utils';
import { ZambdaInput } from '../../shared';

function isPatientEducationSection(value: unknown): value is PatientEducationSection {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.content === 'string' &&
    typeof s.patientTitle === 'string' &&
    typeof s.icdCode === 'string' &&
    typeof s.icdDescription === 'string'
  );
}

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientEducationPdfInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { encounterId, patientId, sections, title } = JSON.parse(input.body);

  const missingFields: string[] = [];
  if (!encounterId) missingFields.push('encounterId');
  if (!patientId) missingFields.push('patientId');
  if (!title) missingFields.push('title');
  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    throw INVALID_INPUT_ERROR('sections must be a non-empty array');
  }
  if (!sections.every(isPatientEducationSection)) {
    throw INVALID_INPUT_ERROR('Each section must have content, patientTitle, icdCode, and icdDescription strings');
  }

  return { encounterId, patientId, sections, title, secrets: input.secrets };
}

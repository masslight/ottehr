import { ZambdaInput } from '../../shared';
import { PatientEducationSection } from '../../shared/pdf/patient-education-pdf';

export interface SavePatientEducationPdfInput {
  encounterId: string;
  patientId: string;
  sections: PatientEducationSection[];
  title: string;
}

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
    throw new Error('No request body provided');
  }

  const { encounterId, patientId, sections, title } = JSON.parse(input.body);

  if (!encounterId) throw new Error('encounterId is required');
  if (!patientId) throw new Error('patientId is required');
  if (!title) throw new Error('title is required');
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('sections must be a non-empty array');
  }
  if (!sections.every(isPatientEducationSection)) {
    throw new Error('Each section must have content, patientTitle, icdCode, and icdDescription strings');
  }

  return { encounterId, patientId, sections, title, secrets: input.secrets };
}

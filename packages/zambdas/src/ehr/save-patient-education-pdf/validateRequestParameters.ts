import { ZambdaInput } from '../../shared';

export interface SavePatientEducationPdfInput {
  encounterId: string;
  patientId: string;
  pdfBase64: string;
  title: string;
}

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientEducationPdfInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId, patientId, pdfBase64, title } = JSON.parse(input.body);

  if (!encounterId) throw new Error('encounterId is required');
  if (!patientId) throw new Error('patientId is required');
  if (!pdfBase64) throw new Error('pdfBase64 is required');
  if (!title) throw new Error('title is required');

  return { encounterId, patientId, pdfBase64, title, secrets: input.secrets };
}

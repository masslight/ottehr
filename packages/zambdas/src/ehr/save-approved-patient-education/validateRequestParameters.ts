import { ApprovedPatientEducationIcdCode, SaveApprovedPatientEducationInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): SaveApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw new Error('No request body provided');
  const body = JSON.parse(input.body) as Partial<SaveApprovedPatientEducationInput>;

  const { pdfBase64, title, icdCodes } = body;
  if (!pdfBase64) throw new Error('pdfBase64 is required');
  if (!title) throw new Error('title is required');
  if (!Array.isArray(icdCodes) || icdCodes.length === 0) throw new Error('icdCodes is required');

  for (const icd of icdCodes) {
    if (!icd?.code) throw new Error('Each icdCodes entry must have a code');
  }

  return {
    pdfBase64,
    title,
    icdCodes: icdCodes as ApprovedPatientEducationIcdCode[],
    secrets: input.secrets,
  };
}

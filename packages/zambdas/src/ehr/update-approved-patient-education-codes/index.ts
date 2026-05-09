import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  UpdateApprovedPatientEducationCodesOutput,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-cm';

function extractIcdCodes(docRef: DocumentReference): string[] {
  const ext = (docRef.extension || []).find((e) => e.url === PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL);
  if (!ext?.extension) return [];
  return ext.extension.map((e) => e.valueCoding?.code).filter((c): c is string => !!c);
}

export const index = wrapHandler(
  'update-approved-patient-education-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { documentReferenceId, icdCodes, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const target = await oystehr.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: documentReferenceId,
      });

      const isApproved = (target.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE);
      if (!isApproved) {
        throw new Error('DocumentReference is not an approved patient education entry');
      }

      const incomingIcdSet = new Set(icdCodes.map((c) => c.code));
      const others = await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'type', value: PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE }],
      });
      const conflictingCodes = new Set<string>();
      for (const other of others.unbundle()) {
        if (other.id === documentReferenceId) continue;
        if (!(other.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE)) continue;
        for (const code of extractIcdCodes(other)) {
          if (incomingIcdSet.has(code)) conflictingCodes.add(code);
        }
      }
      if (conflictingCodes.size > 0) {
        throw new Error(
          `The following ICD codes are already used by other approved PDFs: ${Array.from(conflictingCodes).join(', ')}`
        );
      }

      const updatedDocRef: DocumentReference = {
        ...target,
        extension: [
          ...(target.extension ?? []).filter((e) => e.url !== PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL),
          {
            url: PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
            extension: icdCodes.map((c) => ({
              url: 'icdCode',
              valueCoding: {
                system: ICD10_SYSTEM,
                code: c.code,
                display: c.display,
              },
            })),
          },
        ],
      };

      await oystehr.fhir.update<DocumentReference>(updatedDocRef);

      const output: UpdateApprovedPatientEducationCodesOutput = { documentReferenceId };
      return { statusCode: 200, body: JSON.stringify(output) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('update-approved-patient-education-codes error:', message, error);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }
);

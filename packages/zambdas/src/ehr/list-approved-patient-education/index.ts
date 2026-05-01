import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import {
  ApprovedPatientEducationIcdCode,
  ApprovedPatientEducationItem,
  getPresignedURL,
  ListApprovedPatientEducationOutput,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

function extractIcdCodes(docRef: DocumentReference): ApprovedPatientEducationIcdCode[] {
  const ext = (docRef.extension || []).find((e) => e.url === PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL);
  if (!ext?.extension) return [];
  return ext.extension
    .map((e) => e.valueCoding)
    .filter((c): c is NonNullable<typeof c> => !!c?.code)
    .map((c) => ({ code: c.code!, display: c.display ?? '' }));
}

export const index = wrapHandler(
  'list-approved-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const result = await oystehr.fhir.search<List | DocumentReference>({
        resourceType: 'List',
        params: [
          {
            name: 'identifier',
            value: `${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.system}|${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.value}`,
          },
          { name: '_include', value: 'List:item' },
        ],
      });

      const resources = result.unbundle();
      const docRefs = resources.filter(
        (r): r is DocumentReference =>
          r.resourceType === 'DocumentReference' &&
          (r.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE)
      );

      const items: ApprovedPatientEducationItem[] = await Promise.all(
        docRefs.map(async (docRef) => {
          const z3Url = docRef.content?.[0]?.attachment?.url ?? '';
          const presignedUrl = z3Url ? await getPresignedURL(z3Url, m2mToken) : '';
          return {
            documentReferenceId: docRef.id!,
            title: docRef.content?.[0]?.attachment?.title ?? docRef.description ?? '',
            icdCodes: extractIcdCodes(docRef),
            pdfPresignedUrl: presignedUrl,
          };
        })
      );

      const output: ListApprovedPatientEducationOutput = { items };
      return { statusCode: 200, body: JSON.stringify(output) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('list-approved-patient-education error:', message, error);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }
);

import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import {
  ApprovedPatientEducationItem,
  getPresignedURL,
  getSecret,
  ListApprovedPatientEducationOutput,
  normalizePatientEducationLanguage,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { extractApprovedEducationIcdCodes } from '../shared/approved-patient-education-helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'list-approved-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
      const oystehr = createOystehrClient(m2mToken, validatedInput.secrets);

      const result = await performEffect(oystehr, m2mToken);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('list-approved-patient-education', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (oystehr: Oystehr, token: string): Promise<ListApprovedPatientEducationOutput> => {
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

  const docRefsWithAttachment = docRefs.filter((docRef) => {
    if (!docRef.content?.[0]?.attachment?.url) {
      console.warn(`Skipping approved patient education DocumentReference/${docRef.id} — missing attachment URL`);
      return false;
    }
    return true;
  });

  const items: ApprovedPatientEducationItem[] = await Promise.all(
    docRefsWithAttachment.map(async (docRef) => {
      const z3Url = docRef.content![0].attachment!.url!;
      const presignedUrl = await getPresignedURL(z3Url, token);
      return {
        documentReferenceId: docRef.id!,
        title: docRef.content?.[0]?.attachment?.title ?? docRef.description ?? '',
        icdCodes: extractApprovedEducationIcdCodes(docRef),
        pdfPresignedUrl: presignedUrl,
        language: normalizePatientEducationLanguage(docRef.content?.[0]?.attachment?.language),
      };
    })
  );

  return { items };
};

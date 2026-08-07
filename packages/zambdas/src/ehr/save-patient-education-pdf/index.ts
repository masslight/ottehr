import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { FileDocDataForDocReference } from 'utils/lib/fhir/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  normalizePatientEducationLanguage,
  SavePatientEducationPdfInput,
  SavePatientEducationPdfOutput,
} from 'utils/lib/types/data/patient-education.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import {
  createPatientEducationPdf,
  makePatientEducationPdfDocumentReference,
} from '../../shared/pdf/patient-education-pdf';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'save-patient-education-pdf',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

      const result = await performEffect(validatedInput, oystehr, m2mToken);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('save-patient-education-pdf', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: SavePatientEducationPdfInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<SavePatientEducationPdfOutput> => {
  const { encounterId, patientId, title, secrets } = validatedInput;
  // Tag the attachment's language so EN/ES versions can be told apart; default to English (matches
  // the approved-PDF endpoint and how legacy untagged docs are read back).
  const language = normalizePatientEducationLanguage(validatedInput.language);
  console.log('Saving patient education PDF', {
    encounterId,
    patientId,
    title,
    sectionCount: validatedInput.sections?.length ?? 0,
    hasPdfBase64: Boolean(validatedInput.pdfBase64),
  });

  const pdfBytes = validatedInput.sections
    ? await createPatientEducationPdf(validatedInput.sections, language)
    : Uint8Array.from(Buffer.from(validatedInput.pdfBase64, 'base64'));

  const z3Url = makeZ3Url({
    secrets,
    bucketName: BUCKET_NAMES.PATIENT_EDUCATION,
    patientID: patientId,
    fileName: 'PatientEducation.pdf',
  });
  const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUploadUrl);

  // Return a download URL alongside the DocumentReference so the UI can open the newly
  // approved PDF without a second round-trip (DocumentReference fetch + presign).
  const presignedDownloadUrl = await createPresignedUrl(token, z3Url, 'download');

  const educationListRes = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'title', value: BUCKET_NAMES.PATIENT_EDUCATION },
      ],
    })
  ).unbundle();

  const fileDoc: FileDocDataForDocReference = {
    url: z3Url,
    title,
    language,
  };

  const docRef = await makePatientEducationPdfDocumentReference(
    oystehr,
    fileDoc,
    patientId,
    encounterId,
    educationListRes
  );

  if (!docRef?.id) {
    throw new Error('Failed to create DocumentReference for patient education PDF');
  }

  return {
    documentReferenceId: docRef.id,
    presignedDownloadUrl,
  };
};

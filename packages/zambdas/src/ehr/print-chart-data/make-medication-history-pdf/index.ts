import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Appointment, CodeableConcept, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  getSecret,
  MEDICATION_HISTORY_DOC_REF_CODING,
  MedicationInfoForPrinting,
  Secrets,
  SecretsKeys,
  uploadPDF,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { PdfInfo } from '../../../shared/pdf/pdf-utils';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { ZambdaInput } from '../../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'make-medication-history-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patient, medicationHistory, appointment, encounter, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const output = await makeMedicationHistoryPDF(oystehr, m2mToken, secrets, {
      patient,
      medicationHistory,
      appointment,
      encounter,
    });

    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (error) {
    console.error(error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

interface MedicationHistoryPdfInput {
  patient: Patient;
  appointment: Appointment;
  medicationHistory: MedicationInfoForPrinting;
  encounter: Encounter;
}
const makeMedicationHistoryPDF = async (
  oystehr: Oystehr,
  m2mToken: string,
  secrets: Secrets,
  contentInfo: MedicationHistoryPdfInput
): Promise<PdfInfo> => {
  const patientId = contentInfo.patient.id;
  if (!patientId) throw new Error('No patient id. cannot make medication history pdf');
  console.log(`Creating pdfBytes for patient ${patientId}. Content is ${JSON.stringify(contentInfo)}`);
  const pdfBytes = await createMedicationHistoryPdfBytes(contentInfo).catch((error) => {
    throw new Error(`failed to create medication histroy pdf bytes: ${error.message}`);
  });

  // Upload to z3
  // ATHENA TODO: maybe these should go elsewhere?
  const bucketName = BUCKET_NAMES.VISIT_NOTES;
  const dateCreated = DateTime.now().setZone('UTC').toISO() ?? '';
  const fileName = `MedicationHistory-${patientId}-${dateCreated}.pdf`;
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID: patientId, fileName });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, baseFileUrl, m2mToken, patientId).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  const pdfInfo: PdfInfo = {
    uploadURL: baseFileUrl,
    title: fileName,
  };

  // Make DocumentReference
  const docTypeAndCategory: CodeableConcept = {
    coding: [MEDICATION_HISTORY_DOC_REF_CODING],
    text: 'Medication list',
  };

  const { docRefs } = await createFilesDocumentReferences({
    files: [
      {
        url: pdfInfo.uploadURL,
        title: pdfInfo.title,
      },
    ],
    type: docTypeAndCategory,
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: { encounter: [{ reference: `Encounter/${contentInfo.encounter.id!}` }] },
      category: [docTypeAndCategory],
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [
      { name: 'encounter', value: `Encounter/${contentInfo.encounter.id!}` },
      { name: 'category', value: MEDICATION_HISTORY_DOC_REF_CODING.code },
    ],
    listResources: [], // ATHENA TODO: figure out which folder it makes sense to add this to, if any
  });

  console.log(
    `Medication list DocumentReference are ${JSON.stringify(docRefs.map((docRef) => `DocumentReference/${docRef.id}`))}`
  );

  return pdfInfo;
};

const createMedicationHistoryPdfBytes = async (_contentInfo: MedicationHistoryPdfInput): Promise<Uint8Array> => {
  console.log('Making medication history bytes');
  // ATHENA TODO make a pdf pls
  return {} as Uint8Array;
};

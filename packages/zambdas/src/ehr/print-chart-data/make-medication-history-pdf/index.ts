import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Appointment, CodeableConcept, ContactPoint, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  formatDOB,
  genderMap,
  getPresignedURL,
  getSecret,
  MEDICATION_HISTORY_DOC_REF_CODING,
  MedicationInfoForPrinting,
  Secrets,
  SecretsKeys,
  standardizePhoneNumber,
  uploadPDF,
} from 'utils';
import { checkOrCreateM2MClientToken, getPatientLastFirstName, topLevelCatch, wrapHandler } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { PdfRenderConfig, renderPdf, StyleFactory } from '../../../shared/pdf/pdf-common';
import { PdfInfo, rgbNormalized } from '../../../shared/pdf/pdf-utils';
import {
  composeVisitData,
  createMedicationsSectionForDischargeSummary,
  createPatientHeaderForDischargeSummary,
  createVisitInfoSection,
} from '../../../shared/pdf/sections';
import { AssetPaths, MedicationHistoryInput, PatientInfoForDischargeSummary } from '../../../shared/pdf/types';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { ZambdaInput } from '../../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'make-medication-history-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patient, medicationHistory, appointment, encounter, location, timezone, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const formattedData: MedicationHistoryInput = formatData({
      patient,
      medicationHistory,
      appointment,
      location,
      timezone,
    });

    const output = await makeMedicationHistoryPDF(oystehr, m2mToken, secrets, formattedData, encounter);
    console.log('makeMedicationHistoryPdf output is:', JSON.stringify(output));
    const presignedURL = await getPresignedURL(output.uploadURL, m2mToken);
    return {
      body: JSON.stringify({
        presignedURL,
        title: output.title,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.error(error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

const formatData = ({
  patient,
  medicationHistory,
  appointment,
  location,
  timezone,
}: {
  patient: Patient;
  medicationHistory: MedicationInfoForPrinting[];
  appointment: Appointment;
  location?: Location;
  timezone?: string;
}): MedicationHistoryInput => {
  const patientInfo: PatientInfoForDischargeSummary = {
    fullName: getPatientLastFirstName(patient) ?? '',
    dob: formatDOB(patient?.birthDate) ?? '',
    sex: genderMap[patient.gender as keyof typeof genderMap] ?? '',
    id: patient.id ?? '',
    phone: standardizePhoneNumber(patient.telecom?.find((telecom: ContactPoint) => telecom.system === 'phone')?.value),
  };

  console.log('This is timezone for print medication pdf', timezone);
  const visit = composeVisitData({ appointment, location, timezone: timezone ?? '' });
  console.log('This is visit', visit);

  return {
    patient: patientInfo,
    visit,
    medications: { medications: medicationHistory.map((med) => med.name) },
  };
};

const makeMedicationHistoryPDF = async (
  oystehr: Oystehr,
  m2mToken: string,
  secrets: Secrets,
  contentInfo: MedicationHistoryInput,
  encounter: Encounter
): Promise<PdfInfo> => {
  const patientId = contentInfo.patient.id;
  if (!patientId) throw new Error('No patient id. cannot make medication history pdf');
  console.log(`Creating pdfBytes for patient ${patientId}. Content is ${JSON.stringify(contentInfo)}`);
  const pdfBytes = await createMedicationHistoryPdfBytes(contentInfo, m2mToken).catch((error) => {
    throw new Error(`failed to create medication history pdf bytes: ${error.message}`);
  });

  // Upload to z3
  // maybe these should go elsewhere?
  const bucketName = BUCKET_NAMES.VISIT_NOTES;
  const nowTimestamp = DateTime.now().setZone('UTC').toSeconds();
  const fileName = `MedicationHistory-${nowTimestamp}.pdf`;
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

  console.log('pdf info is', JSON.stringify(pdfInfo));

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
      context: { encounter: [{ reference: `Encounter/${encounter.id ?? ''}` }] },
      category: [docTypeAndCategory],
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [
      { name: 'encounter', value: `Encounter/${encounter.id ?? ''}` },
      { name: 'category', value: MEDICATION_HISTORY_DOC_REF_CODING.code },
    ],
    listResources: [], // intentionally not adding to a folder for the moment
  });

  console.log(
    `Medication list DocumentReference are ${JSON.stringify(docRefs.map((docRef) => `DocumentReference/${docRef.id}`))}`
  );

  return pdfInfo;
};

const createMedicationHistoryPdfBytes = async (
  contentInfo: MedicationHistoryInput,
  token: string
): Promise<Uint8Array> => {
  console.log('Making medication history bytes');

  const bytes = await renderPdf(contentInfo, medicationHistoryRenderConfig, token);
  console.log('Successfully made bytes!');
  return bytes;
};

// following the rough approach that the discharge summary uses for this section
const assetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
  },
  icons: {
    call: './assets/call.png',
    inconclusive: './assets/inconclusive.png',
    abnormal: './assets/abnormal.png',
    normal: './assets/normal.png',
  },
};

const styles: StyleFactory = (assets) => ({
  textStyles: {
    header: {
      fontSize: 16,
      font: assets.fonts.bold,
      side: 'right',
      spacing: 5,
      newLineAfter: true,
    },
    patientName: {
      fontSize: 16,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 14,
      font: assets.fonts.bold,
      spacing: 5,
      newLineAfter: true,
    },
    attachmentTitle: {
      fontSize: 12,
      font: assets.fonts.regular,
      color: rgbNormalized(102, 102, 102),
      spacing: 2,
      newLineAfter: true,
    },
    regular: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    regularText: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 2,
      newLineAfter: true,
    },
    bold: {
      fontSize: 12,
      font: assets.fonts.bold,
      spacing: 2,
      newLineAfter: true,
    },
  },
  lineStyles: {
    separator: {
      thickness: 1,
      color: rgbNormalized(227, 230, 239),
      margin: { top: 8, bottom: 8 },
    },
  },
});

const medicationHistoryRenderConfig: PdfRenderConfig<MedicationHistoryInput> = {
  header: {
    title: 'Medication History',
    leftSection: createPatientHeaderForDischargeSummary(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: assetPaths,
  styleFactory: styles,
  sections: [createMedicationsSectionForDischargeSummary()],
};

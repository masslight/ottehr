import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, FhirResource, Organization, Patient } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { PageSizes } from 'pdf-lib';
import { getFullName, getPatientAddress, getSecret, Secrets, SecretsKeys, uploadPDF } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createPdfClient, PdfInfo, rgbNormalized, savePdfLocally } from '../../shared/pdf/pdf-utils';
import { PdfClientStyles, TextStyle } from '../../shared/pdf/types';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;

export const index = wrapHandler('create-receipt', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { encounterId, secrets } = validatedParameters;

    oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
    const oystehr = createOystehrClient(oystehrToken, secrets);

    const receiptData = await getReceiptData(encounterId, oystehr);
    console.log('Got receipt data: ', JSON.stringify(receiptData));
    console.log('Creating receipt pdf');
    const receiptPdf = await createReceiptPdf(receiptData);
    console.log('Created receipt pdf');
    const response = await createReplaceReceiptOnZ3(receiptPdf, receiptData.patient.id, secrets, oystehrToken);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('create-receipt', error, ENVIRONMENT);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
});

type paymentType = 'cash' | 'check' | 'card';

interface PaymentData {
  amount: number;
  type: paymentType;
}

interface ReceiptData {
  receiptDate: string;
  visitDate: string;
  payments: PaymentData[];
  organization: {
    name: string;
    street: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
  patient: {
    id: string;
    name: string;
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

async function getReceiptData(encounterId: string, oystehr: Oystehr): Promise<ReceiptData> {
  const requestBundle = await oystehr.fhir.search<FhirResource>({
    resourceType: 'Encounter',
    params: [
      { name: '_id', value: encounterId },
      { name: '_revinclude', value: 'PaymentNotice:request' },
      // { name: '_include', value: 'PaymentNotice:recipient' },
      { name: '_include', value: 'Encounter:subject' },
      { name: '_include', value: 'Encounter:appointment' },
    ],
  });
  const resources = requestBundle.unbundle();
  // todo we have a problem here because for each payment we have Organization field
  // so what if for some fields it'll be different than for others??

  // todo, i have kinda problem fetching Organization
  const organization = resources.find((r) => r.resourceType === 'Organization') as Organization;
  const patient = resources.find((r) => r.resourceType === 'Patient') as Patient;
  const patientAddress = getPatientAddress(patient.address);
  const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
  // if (!organization) throw new Error('Organization not found');
  if (!patient) throw new Error('Patient not found');
  if (!appointment) throw new Error('Appointment not found');
  // todo: what date should i use as visitDate?
  return {
    receiptDate: DateTime.now().toString(),
    visitDate: appointment.end ?? '',
    payments: [],
    organization: {
      name: organization?.name ?? '',
      street: '??',
      street2: '??',
      city: '??',
      state: '??',
      zip: '??',
      phone: '??',
    },
    patient: {
      id: patient.id!,
      name: getFullName(patient) ?? '',
      street: patientAddress.addressLine,
      street2: patientAddress.addressLine2,
      city: patientAddress.city,
      state: patientAddress.state,
      zip: patientAddress.zipStateCityLine,
    },
  };
}

async function createReceiptPdf(receiptData: ReceiptData): Promise<Uint8Array> {
  console.log('receiptData: ', JSON.stringify(receiptData));
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        top: 40,
        bottom: 40,

        // Left and right margins should be 37 to fit item "* Intact recent and remote memory, judgment and insight".
        // The design of this page will be changed soon, so this simple fix is optimal for now.
        right: 37,
        left: 37,
      },
    },
  };

  console.log('creating client');
  const pdfClient = await createPdfClient(pdfClientStyles);
  console.log('created client');

  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const RubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 20,
      font: RubikFontBold,
      spacing: 17,
      side: 'right',
      newLineAfter: true,
    },
    blockHeader: {
      fontSize: 18,
      spacing: 8,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    blockSubHeader: {
      fontSize: 16,
      spacing: 1,
      font: RubikFontBold,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    fieldText: {
      fontSize: 16,
      spacing: 6,
      font: RubikFont,
      side: 'right',
      newLineAfter: true,
    },
    regularText: {
      fontSize: 16,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
    },
    smallGreyText: {
      fontSize: 14,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(143, 154, 167),
    },
  };
  // pdfClient.setPageStyles(pageStylesWithHeadline);

  const drawBlockHeader = (text: string, styles = textStyles.blockHeader): void => {
    const headerTextDims = pdfClient.getTextDimensions(text, styles);
    const regularTextDims = pdfClient.getTextDimensions('a', textStyles.regularText);
    if (
      pdfClient.getY() - headerTextDims.height - (styles.newLineAfter ? styles.spacing : 0) - regularTextDims.height <
      (pdfClientStyles.initialPage.pageMargins.bottom ?? 0)
    ) {
      pdfClient.addNewPage(pdfClientStyles.initialPage);
    }
    pdfClient.drawText(text, styles);
  };

  const regularText = (text?: string, alternativeText?: string): void => {
    if (text) pdfClient.drawText(text, textStyles.regularText);
    else if (alternativeText) pdfClient.drawText(alternativeText, textStyles.alternativeRegularText);
  };

  drawBlockHeader('Receipt');
  regularText('some regular text');

  return await pdfClient.save();
}

async function createReplaceReceiptOnZ3(
  pdfBytes: Uint8Array,
  patientId: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  const bucketName = 'receipts';
  const fileName = 'receipt.pdf';
  console.log('Creating base file url');
  console.log('patientId: ', patientId);
  const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID: patientId, fileName });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl, patientId).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  savePdfLocally(pdfBytes);
  return { title: fileName, uploadURL: baseFileUrl };
}

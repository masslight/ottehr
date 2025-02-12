import { Patient } from 'fhir/r4b';
import fs from 'fs';
import { PageSizes } from 'pdf-lib';
import { makeZ3Url, Secrets } from 'zambda-utils';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { createPdfClient, PdfInfo } from './pdf-utils';
import { ImageStyle, PdfClientStyles, ReceiptData, TextStyle } from './types';

async function createReceiptPdfBytes(data: ReceiptData): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      },
    },
  };
  const pdfClient = await createPdfClient(pdfClientStyles);

  const RobotoFont = await pdfClient.embedFont(fs.readFileSync('./Roboto-Regular.otf'));
  const RobotoFontBold = await pdfClient.embedFont(fs.readFileSync('./Roboto-Bold.otf'));
  const ottehrLogo = await pdfClient.embedImage(fs.readFileSync('./ottehrLogo.png'));

  const textStyles: Record<string, TextStyle> = {
    blockHeader: {
      fontSize: 12,
      spacing: 12,
      font: RobotoFontBold,
      newLineAfter: true,
    },
    fieldHeader: {
      fontSize: 12,
      font: RobotoFont,
      spacing: 1,
    },
    fieldText: {
      fontSize: 12,
      spacing: 6,
      font: RobotoFont,
      side: 'right',
      newLineAfter: true,
    },
  };

  const imgStyles: ImageStyle = {
    width: 190,
    height: 47,
    center: true,
  };

  const drawBlockHeader = (text: string): void => {
    pdfClient.drawText(text, textStyles.blockHeader);
  };

  const drawFieldLine = (fieldName: string, fieldValue: string): void => {
    pdfClient.drawText(fieldName, textStyles.fieldHeader);
    pdfClient.drawText(fieldValue, textStyles.fieldText);
  };

  pdfClient.drawImage(ottehrLogo, imgStyles);
  if (data.facility) {
    drawFieldLine('Facility:', data.facility.name);
    drawFieldLine('Facility Address:', data.facility.address);
    drawFieldLine('Facility Phone:', data.facility.phone);
    pdfClient.newLine(12);
  }
  drawFieldLine('Patient Name:', data.patient.name);
  drawFieldLine('Patient DOB:', data.patient.dob);
  drawFieldLine('Patient Account #:', data.patient.account);
  pdfClient.newLine(36);
  drawBlockHeader('Receipt of Payment');
  pdfClient.newLine(12);
  pdfClient.drawText(
    'Credit Card Transaction Details(card ending, card type, athorization/transaction number)',
    textStyles.fieldHeader
  );
  pdfClient.newLine(24);
  drawFieldLine('Amount:', data.amount);
  drawFieldLine('Date:', data.date);

  return await pdfClient.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createReceiptPdf(
  input: ReceiptData,
  patient: Patient,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating Receipt PDF');
  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }
  const pdfBytes = await createReceiptPdfBytes(input).catch((error) => {
    throw new Error('failed creating pdfBytes: ' + error.message);
  });

  const bucketName = 'receipts';
  const fileName = 'Receipt.pdf';
  const baseFileUrl = makeZ3Url({ secrets, fileName, bucketName, patientID: patient.id });

  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  return { title: fileName, uploadURL: baseFileUrl };
}

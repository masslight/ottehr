import { min } from 'lodash';
import { DateTime } from 'luxon';
import { Secrets } from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { getLabFileName } from './labs-results-form-pdf';
import { ICON_STYLE, STANDARD_NEW_LINE } from './pdf-consts';
import {
  drawFieldLineBoldHeader,
  getPdfClientForLabsPDFs,
  PdfInfo,
  rgbNormalized,
  SEPARATED_LINE_STYLE as GREY_LINE_STYLE,
} from './pdf-utils';
import { LabsData, PdfClient } from './types';

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsOrderFormPDF(
  input: LabsData,
  patientID: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsOrderFormPdfBytes(input).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  const fileName = `ExternalLabsOrderForm-${
    input.orderName ? getLabFileName(input.orderName) + '-' : ''
  }-${DateTime.fromISO(input.orderCreateDateAuthoredOn).toFormat('yyyy-MM-dd')}-${input.orderPriority}.pdf`;
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, fileName, bucketName, patientID });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

async function createExternalLabsOrderFormPdfBytes(data: LabsData): Promise<Uint8Array> {
  if (!data.orderName) {
    throw new Error('Order name is required');
  }
  console.log('drawing pdf for ', data.orderNumber, data.orderName);

  let pdfClient: PdfClient;
  const { pdfClient: client, callIcon, faxIcon, locationIcon, textStyles } = await getPdfClientForLabsPDFs();
  pdfClient = client;

  const iconStyleWithMargin = { ...ICON_STYLE, margin: { left: 10, right: 10 } };
  const rightColumnXStart = 315;
  const BLACK_LINE_STYLE = { ...GREY_LINE_STYLE, color: rgbNormalized(0, 0, 0) };

  // Draw header
  pdfClient.drawText(`${data.labOrganizationName}: Order Form`, textStyles.headerRight); // the original was 18 font
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Location Details (left column)
  const yPosAtStartOfLocation = pdfClient.getY();
  let yPosAtEndOfLocation = yPosAtStartOfLocation;
  if (
    data.locationName ||
    data.locationStreetAddress ||
    data.locationCity ||
    data.locationState ||
    data.locationZip ||
    data.locationPhone ||
    data.locationFax
  ) {
    if (data.locationName) {
      pdfClient.drawTextSequential(data.locationName, textStyles.textBold);
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    pdfClient.drawImage(
      locationIcon,
      { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
      textStyles.text
    );
    const xPosAfterImage = pdfClient.getX();
    if (data.locationStreetAddress) {
      pdfClient.drawTextSequential(data.locationStreetAddress.toUpperCase(), textStyles.text, {
        leftBound: xPosAfterImage,
        rightBound: pdfClient.getRightBound(),
      });
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    if (data.locationCity || data.locationState || data.locationZip) {
      pdfClient.drawStartXPosSpecifiedText(
        `${data.locationCity ? data.locationCity + ', ' : ''}${data.locationState ? data.locationState + ' ' : ''}${
          data.locationZip || ''
        }`.toUpperCase(),
        textStyles.text,
        xPosAfterImage
      );
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    // the phone and fax should be on the same line
    if (data.locationPhone) {
      pdfClient.drawImage(
        callIcon,
        { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
        textStyles.text
      );
      pdfClient.drawTextSequential(data.locationPhone, textStyles.text);
    }

    if (data.locationFax) {
      pdfClient.drawImage(faxIcon, iconStyleWithMargin, textStyles.text);
      pdfClient.drawTextSequential(data.locationFax, textStyles.text);
    }

    if (data.locationPhone || data.locationFax) {
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    yPosAtEndOfLocation = pdfClient.getY();
  }

  // Order number, physician info (right column)
  // go back to where the location info started to start the right column of text
  pdfClient.setY(yPosAtStartOfLocation);
  let currXPos = pdfClient.drawStartXPosSpecifiedText('Order Number: ', textStyles.textBold, rightColumnXStart).endXPos;
  pdfClient.drawStartXPosSpecifiedText(data.orderNumber, textStyles.text, currXPos).endXPos;

  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawStartXPosSpecifiedText(data.providerName, textStyles.textBold, rightColumnXStart);
  pdfClient.newLine(STANDARD_NEW_LINE);

  if (data.providerNPI) {
    currXPos = pdfClient.drawStartXPosSpecifiedText('NPI: ', textStyles.textBold, rightColumnXStart).endXPos;
    pdfClient.drawStartXPosSpecifiedText(data.providerNPI, textStyles.text, currXPos);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  currXPos = pdfClient.drawStartXPosSpecifiedText('Client ID: ', textStyles.textBold, rightColumnXStart).endXPos;
  pdfClient.drawStartXPosSpecifiedText(data.accountNumber, textStyles.text, currXPos);

  // figure out which column drew farther down in the y direction, and set the new y to that, then add newline
  pdfClient.setY(min([pdfClient.getY(), yPosAtEndOfLocation])!);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Line before patient info
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Patient info (left column)
  pdfClient.drawTextSequential(
    `${data.patientLastName}, ${data.patientFirstName}${data.patientMiddleName ? ' ' + data.patientMiddleName : ''}, `,
    { ...textStyles.header, newLineAfter: false }
  );
  pdfClient.drawTextSequential(`${data.patientSex}, ${data.patientDOB}`, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'ID:', data.patientId);
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawImage(
    locationIcon,
    { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
    textStyles.text
  );
  pdfClient.drawTextSequential(`${data.patientAddress} `, textStyles.text);
  pdfClient.drawImage(callIcon, iconStyleWithMargin, textStyles.text);
  pdfClient.drawTextSequential(data.patientPhone, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Order date and collection date
  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Order Date:', data.orderCreateDate);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // TODO: with our new change to sample collection, I wonder if this type should be updated to be required for collectionDate
  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Order Collection Date:', data.sampleCollectionDate ?? '');
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Insurance/billing Section
  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Bill Class:', data.billClass);
  pdfClient.newLine(STANDARD_NEW_LINE);

  if (data.primaryInsuranceName) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Primary Insurance Name:', data.primaryInsuranceName);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.primaryInsuranceAddress) {
    pdfClient = drawFieldLineBoldHeader(
      pdfClient,
      textStyles,
      'Insurance Address:',
      data.primaryInsuranceAddress.toUpperCase()
    );
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.primaryInsuranceSubNum) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Subscriber Number:', data.primaryInsuranceSubNum);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.insuredName) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Insured Name:', data.insuredName);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.insuredAddress) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Address:', data.insuredAddress);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // AOE Section
  if (data.aoeAnswers?.length) {
    pdfClient.drawTextSequential('AOE Answers', textStyles.header);
    data.aoeAnswers.forEach((item) => {
      pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, `${item.question}: `, item.answer.toString());
      pdfClient.newLine(STANDARD_NEW_LINE);
    });
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  // Ordered test and diagnoses
  const columnGap = 50;
  const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
  const secondColumnStart = pageWidth / 2 + columnGap;

  const columnOneStartAndWidth = { startXPos: pdfClient.getLeftBound(), width: pageWidth / 2 };
  const columnTwoStartAndWidth = { startXPos: secondColumnStart, width: pdfClient.getRightBound() - secondColumnStart }; // just the rest of the page

  pdfClient.drawSeparatedLine(GREY_LINE_STYLE);
  pdfClient.drawVariableWidthColumns(
    [
      {
        content: 'Lab',
        textStyle: textStyles.text,
        ...columnOneStartAndWidth,
      },
      {
        content: 'Assessments',
        textStyle: textStyles.text,
        ...columnTwoStartAndWidth,
      },
    ],
    pdfClient.getY()
  );
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(GREY_LINE_STYLE);

  // second row
  pdfClient.drawVariableWidthColumns(
    [
      {
        content: data.orderName.toUpperCase(),
        textStyle: textStyles.textBold,
        ...columnOneStartAndWidth,
      },
      {
        content: data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', '),
        textStyle: textStyles.text,
        ...columnTwoStartAndWidth,
      },
    ],
    pdfClient.getY()
  );

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Signature
  pdfClient.drawTextSequential(`Electronically signed by: ${data.providerName}`, textStyles.textBold);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawTextSequential(data.orderSubmitDate, textStyles.textGreyBold);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Generated by Ottehr
  pdfClient.drawTextSequential('Order generated by Ottehr', textStyles.textGreyBold);

  return await pdfClient.save();
}

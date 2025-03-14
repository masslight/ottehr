import fontkit from '@pdf-lib/fontkit';
import { Patient } from 'fhir/r4';
import fs from 'fs';
import { PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { makeZ3Url, Secrets } from 'zambda-utils';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { PdfInfo } from './pdf-utils';
import { ExternalLabsData } from './types';

async function createExternalLabsOrderFormPdfBytes(data: ExternalLabsData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { height, width } = page.getSize();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const locationIcon = './location_on.png';
  const callIcon = './call.png';
  const faxIcon = './fax.png';

  const styles = {
    image: {
      width: 110,
      height: 28,
    },
    header: {
      font: helveticaBoldFont,
      fontSize: 18,
    },
    subHeader: {
      font: helveticaBoldFont,
      fontSize: 12,
    },
    regularText: {
      font: helveticaFont,
      fontSize: 10,
    },
    regularTextBold: {
      font: helveticaBoldFont,
      fontSize: 10,
    },
    spacing: {
      image: 12,
      regularText: 2,
      header: 25,
      paragraph: 3,
      block: 60,
    },
    margin: {
      x: 40,
      y: 40,
    },
  };

  let currYPos = height - styles.margin.y;
  let currXPos = styles.margin.x;
  const regularLineHeight = 14;
  const regularTextWidth = 5;
  const subHeaderTextWidth = 6;
  const pageTextWidth = width - styles.margin.x * 2;
  const lightGreyOpacity = 0.12;
  const darkGreyOpacity = 0.6;
  const imageWidth = 12;
  const imageHeight = 12;

  const addNewLine = (height?: number, count?: number): void => {
    const heightOfLines = height || regularLineHeight;
    const numberOfLines = count || 1;
    currYPos -= heightOfLines * numberOfLines;
  };

  const drawHeader = (text: string): void => {
    const font = styles.header.font;
    const size = styles.header.fontSize;
    const textWidth = font.widthOfTextAtSize(text, size);
    const xPosition = width - styles.margin.x - textWidth;

    page.drawText(text, {
      font: font,
      size: size,
      x: xPosition,
      y: currYPos,
    });
  };

  const drawSubHeader = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: currXPos,
      y: currYPos,
    });
  };

  const drawFieldLineLeft = (fieldName: string, fieldValue: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const maxWidth = pageTextWidth - font.widthOfTextAtSize(fieldName, size) - regularTextWidth;

    const splitTextIntoLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach((word) => {
        const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(lineWithWord, size) <= maxWidth) {
          currentLine = lineWithWord;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) lines.push(currentLine);
      return lines;
    };

    page.drawText(fieldName, {
      font: styles.regularTextBold.font,
      size: styles.regularTextBold.fontSize,
      x: currXPos,
      y: currYPos,
    });

    const lines = splitTextIntoLines(fieldValue, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, {
        font,
        size,
        x: currXPos + font.widthOfTextAtSize(fieldName, size) + regularTextWidth,
        y: currYPos - index * regularLineHeight,
      });
    });

    currYPos -= regularLineHeight * (lines.length - 1);
  };

  const drawFieldLineRight = (fieldName: string, fieldValue: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const textWidth = font.widthOfTextAtSize(fieldName, size) + font.widthOfTextAtSize(fieldValue, size);
    const namePosition = width - (styles.margin.x + textWidth + regularTextWidth);
    const valuePosition = width - (styles.margin.x + font.widthOfTextAtSize(fieldValue, size));
    page.drawText(fieldName, {
      font: styles.regularTextBold.font,
      size: styles.regularTextBold.fontSize,
      x: namePosition,
      y: currYPos,
    });
    page.drawText(fieldValue, {
      font: styles.regularText.font,
      size: styles.regularText.fontSize,
      x: valuePosition,
      y: currYPos,
    });
  };

  const drawColumnText = (
    columnOneName: string,
    columnOneFont: PDFFont,
    columnOneFontSize: number,
    columnTwoName: string,
    columnTwoFont: PDFFont,
    columnTwoFontSize: number
  ): void => {
    page.drawText(columnOneName, {
      font: columnOneFont,
      size: columnOneFontSize,
      x: currXPos,
      y: currYPos,
    });
    page.drawText(columnTwoName, {
      font: columnTwoFont,
      size: columnTwoFontSize,
      x: pageTextWidth / 2,
      y: currYPos,
    });
  };

  const drawRegularTextLeft = (text: string, textFont?: PDFFont, opacity?: number): void => {
    page.drawText(text, {
      font: textFont || styles.regularText.font,
      size: styles.regularText.fontSize,
      opacity: opacity,
      x: currXPos,
      y: currYPos,
    });
  };

  const drawRegularTextRight = (text: string, textFont?: PDFFont): void => {
    textFont = textFont || styles.regularText.font;
    const textWidth = textFont.widthOfTextAtSize(text, styles.regularText.fontSize);
    const xPosition = width - (styles.margin.x + textWidth);

    page.drawText(text, {
      font: textFont,
      size: styles.regularText.fontSize,
      x: xPosition,
      y: currYPos,
    });
  };

  const drawImage = async (imgPath: string): Promise<void> => {
    const imgBytes = fs.readFileSync(imgPath);
    const img = pdfDoc.embedPng(imgBytes);
    currYPos -= 1.5;
    page.drawImage(await img, {
      x: currXPos,
      y: currYPos,
      width: imageWidth,
      height: imageHeight,
    });
    currYPos += 1.5;
  };

  const drawSeparatorLine = (opacity?: number): void => {
    page.drawLine({
      start: { x: currXPos, y: currYPos },
      end: { x: width - styles.margin.x, y: currYPos },
      thickness: 1,
      opacity: opacity,
    });
    currYPos -= regularLineHeight / 2;
  };

  // --- add all sections to PDF ---
  // ===============================
  // Main header
  drawHeader('Order Form');
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Location details
  drawSubHeader(`Ottehr${data.locationName}`);
  drawFieldLineRight('Req ID:', data.reqId);
  addNewLine();
  await drawImage(locationIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.locationStreetAddress.toUpperCase());
  drawRegularTextRight(`${data.providerName}, ${data.providerTitle}`, styles.regularText.font);
  addNewLine();
  currXPos = styles.margin.x + imageWidth + regularTextWidth;
  drawRegularTextLeft(
    `${data.locationCity.toUpperCase()}, ${data.locationState.toUpperCase()} ${data.locationZip.toUpperCase()}`
  );
  drawFieldLineRight('NPI:', data.providerNPI);
  addNewLine();
  currXPos = styles.margin.x;
  await drawImage(callIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.locationPhone);
  currXPos += helveticaFont.widthOfTextAtSize(data.locationPhone, styles.regularText.fontSize) + regularTextWidth;
  await drawImage(faxIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.locationFax);
  drawRegularTextRight(data.serviceName.toUpperCase());
  currXPos = styles.margin.x;
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Patient details block
  drawSubHeader(`${data.patientFirstName},`);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientFirstName, styles.subHeader.fontSize) + subHeaderTextWidth;
  drawSubHeader(`${data.patientMiddleName},`);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientMiddleName, styles.subHeader.fontSize) + subHeaderTextWidth;
  drawSubHeader(`${data.patientLastName},`);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientLastName, styles.subHeader.fontSize) + subHeaderTextWidth;
  drawRegularTextLeft(`${data.patientSex},`);
  currXPos += styles.subHeader.font.widthOfTextAtSize(data.patientSex, styles.regularText.fontSize) + regularTextWidth;
  drawRegularTextLeft(`${data.patientDOB},`);
  currXPos += styles.subHeader.font.widthOfTextAtSize(data.patientDOB, styles.regularText.fontSize) + regularTextWidth;
  drawFieldLineLeft('ID:', data.patientId);
  drawFieldLineRight(`Today's Date:`, data.todayDate);
  addNewLine();
  currXPos = styles.margin.x;
  await drawImage(locationIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.patientAddress);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientAddress, styles.regularText.fontSize) + regularTextWidth;
  await drawImage(callIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.patientPhone);
  drawFieldLineRight('Order Date:', data.orderDate);
  currXPos = styles.margin.x;
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Insurance details, conditionally displayed
  if (data.primaryInsuranceName) drawFieldLineLeft('Primary Insurance Name:', data.primaryInsuranceName.toUpperCase());
  addNewLine();
  if (data.primaryInsuranceAddress) drawFieldLineLeft('Insurance Address:', data.primaryInsuranceAddress.toUpperCase());
  addNewLine();
  if (data.primaryInsuranceSubNum) drawFieldLineLeft('Subscriber Number:', data.primaryInsuranceSubNum);
  addNewLine();
  if (data.insuredName) drawFieldLineLeft('Insured Name:', data.insuredName);
  addNewLine();
  if (data.insuredAddress) drawFieldLineLeft('Address:', data.insuredAddress);
  addNewLine();
  if (
    data.primaryInsuranceName ||
    data.primaryInsuranceAddress ||
    data.primaryInsuranceSubNum ||
    data.insuredAddress ||
    data.insuredName
  ) {
    drawSeparatorLine();
    addNewLine();
  }

  // AOE Answers section
  if (data.aoeAnswers && Array.isArray(data.aoeAnswers)) {
    drawSubHeader('AOE Answers');
    addNewLine();

    data.aoeAnswers.forEach((answer, index) => {
      drawFieldLineLeft(`Question ${index + 1}:`, answer);
      addNewLine();
    });

    addNewLine();
  }

  // Additional fields
  drawSeparatorLine(lightGreyOpacity);
  addNewLine(regularLineHeight / 2);
  drawColumnText(
    'Lab',
    styles.regularText.font,
    styles.regularText.fontSize,
    'Assessment(s)',
    styles.regularText.font,
    styles.regularText.fontSize
  );
  addNewLine(regularLineHeight / 2);
  drawSeparatorLine(lightGreyOpacity);
  addNewLine();
  drawColumnText(
    data.labType.toUpperCase(),
    styles.subHeader.font,
    styles.subHeader.fontSize,
    `${data.assessmentCode} ${data.assessmentName}`,
    styles.regularText.font,
    styles.regularText.fontSize
  );
  addNewLine(undefined, 4);

  // Signature
  drawRegularTextLeft(
    `Electronically signed by: ${data.providerName}, ${data.providerTitle}`,
    styles.regularTextBold.font
  );
  addNewLine();
  drawSeparatorLine();
  addNewLine();
  drawRegularTextLeft('Order generated by Ottehr', styles.regularTextBold.font, darkGreyOpacity);
  return await pdfDoc.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsOrderFormPDF(
  input: ExternalLabsData,
  patient: Patient,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  if (!patient.id) {
    throw new Error('No patient id found for external lab order');
  }

  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsOrderFormPdfBytes(input).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  const fileName = 'ExternalLabsOrderForm.pdf';
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, fileName, bucketName, patientID: patient.id });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

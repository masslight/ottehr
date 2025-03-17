import fontkit from '@pdf-lib/fontkit';
import { Patient } from 'fhir/r4';
import fs from 'fs';
import { Color, PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { makeZ3Url, Secrets } from 'zambda-utils';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { PdfInfo, rgbNormalized } from './pdf-utils';
import { LabResultsData } from './types';

async function createExternalLabsResultsFormPdfBytes(data: LabResultsData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { height, width } = page.getSize();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const callIcon = './call.png';
  const faxIcon = './fax.png';

  const styles = {
    image: {
      width: 110,
      height: 28,
    },
    largeHeader: {
      font: helveticaBoldFont,
      fontSize: 18,
    },
    subHeader: {
      font: helveticaBoldFont,
      fontSize: 14,
    },
    regularText: {
      font: helveticaFont,
      fontSize: 12,
    },
    regularTextBold: {
      font: helveticaBoldFont,
      fontSize: 12,
    },
    spacing: {
      image: 12,
      regularText: 2,
      header: 25,
      paragraph: 3,
      block: 60,
    },
    margin: {
      x: 20,
      y: 20,
    },
    colors: {
      lightGrey: rgbNormalized(223, 229, 233),
      purple: rgbNormalized(77, 21, 183),
      red: rgbNormalized(198, 40, 40),
      black: rgbNormalized(0, 0, 0),
    },
  };

  let currYPos = height - styles.margin.y;
  let currXPos = styles.margin.x;
  const regularLineHeight = 14;
  const regularTextWidth = 5;
  const pageTextWidth = width - styles.margin.x * 2;
  const imageWidth = 12;
  const imageHeight = 12;

  const addNewLine = (height?: number, count?: number): void => {
    const heightOfLines = height || regularLineHeight;
    const numberOfLines = count || 1;
    currYPos -= heightOfLines * numberOfLines;
  };

  const drawHeader = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;
    const textWidth = font.widthOfTextAtSize(text, size);
    const xPosition = width - styles.margin.x - textWidth;

    page.drawText(text, {
      font: font,
      size: size,
      x: xPosition,
      y: currYPos,
      color: styles.colors.purple,
    });
  };

  const drawLargeHeader = (text: string): void => {
    const font = styles.largeHeader.font;
    const size = styles.largeHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: currXPos,
      y: currYPos,
      color: styles.colors.purple,
    });
  };
  const drawSubHeaderLeft = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: currXPos,
      y: currYPos,
    });
  };

  const drawSubHeaderRight = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: width - (styles.margin.x + font.widthOfTextAtSize(text, size)),
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
      font,
      size,
      x: currXPos,
      y: currYPos,
    });

    const lines = splitTextIntoLines(fieldValue, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, {
        font: styles.regularTextBold.font,
        size: styles.regularTextBold.fontSize,
        x: currXPos + font.widthOfTextAtSize(fieldName, size) + regularTextWidth,
        y: currYPos - index * regularLineHeight,
      });
    });

    currYPos -= regularLineHeight * (lines.length - 1);
  };

  const drawFieldLineRight = (fieldName: string, fieldValue: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const namePosition = pageTextWidth * 0.6;
    const valuePosition = namePosition + (regularTextWidth + font.widthOfTextAtSize(fieldName, size));
    page.drawText(fieldName, {
      font: styles.regularText.font,
      size: styles.regularText.fontSize,
      x: namePosition,
      y: currYPos,
    });
    page.drawText(fieldValue, {
      font: styles.regularTextBold.font,
      size: styles.regularTextBold.fontSize,
      x: valuePosition,
      y: currYPos,
    });
  };

  const drawRegularTextLeft = (text: string, textFont?: PDFFont): void => {
    page.drawText(text, {
      font: textFont || styles.regularText.font,
      size: styles.regularText.fontSize,
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

  const drawFiveColumnText = (
    columnOneName: string,
    columnTwoName: string,
    columnThreeName: string,
    columnFourName: string,
    columnFiveName: string,
    columnFont?: PDFFont,
    columnFontSize?: number,
    color?: Color
  ): void => {
    const font = columnFont || styles.regularText.font;
    const fontSize = columnFontSize || styles.regularText.fontSize;
    const fontColor = color || styles.colors.black;
    page.drawText(columnOneName, {
      font: font,
      size: fontSize,
      x: currXPos,
      y: currYPos,
      color: styles.colors.black,
    });
    page.drawText(columnTwoName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 10,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnThreeName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 2,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnFourName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 1.5,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnFiveName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 1.1,
      y: currYPos,
      color: fontColor,
    });
  };

  const drawFreeText = (freeText: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const maxWidth = pageTextWidth - styles.margin.x * 2;

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

    const lines = splitTextIntoLines(freeText, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, {
        font,
        size,
        x: currXPos + styles.margin.x,
        y: currYPos - index * regularLineHeight,
      });
    });

    currYPos -= regularLineHeight * (lines.length - 1);
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

  const drawSeparatorLine = (paddingLeft?: number, paddingRight?: number): void => {
    page.drawLine({
      start: { x: paddingLeft || 0, y: currYPos },
      end: { x: paddingRight || width, y: currYPos },
      thickness: 1,
      color: styles.colors.lightGrey,
    });
    currYPos -= regularLineHeight / 2;
  };

  const calculateAge = (dob: string): number => {
    const dobDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const referenceRangeText = (): string => {
    if (data.specimenReferenceRange) {
      return data.specimenReferenceRange;
    } else {
      return '';
    }
  };

  const referenceRangeTitle = (): string => {
    if (data.specimenReferenceRange) {
      return 'Reference Range'.toUpperCase();
    } else {
      return '';
    }
  };

  // --- add all sections to PDF ---
  // ===============================
  // Main header
  addNewLine();
  drawSubHeaderLeft(`${data.patientLastName}, ${data.patientFirstName}, ${data.patientMiddleName}`);
  drawSubHeaderRight(`Ottehr${data.locationName}`);
  addNewLine();
  drawRegularTextLeft(
    `${data.patientDOB}, ${calculateAge(data.patientDOB)} Y, ${data.patientSex}, ID: ${data.patientId}`
  );
  drawRegularTextRight(
    `${data.locationStreetAddress.toUpperCase()}, ${data.locationCity.toUpperCase()}, ${data.locationState.toUpperCase()}, ${
      data.locationZip
    }`
  );
  addNewLine();
  drawRegularTextLeft(data.patientPhone);
  currXPos =
    width -
    styles.margin.x -
    imageWidth * 2 -
    regularTextWidth * 3 -
    styles.regularText.font.widthOfTextAtSize(data.locationPhone, styles.regularText.fontSize) -
    styles.regularText.font.widthOfTextAtSize(data.locationFax, styles.regularText.fontSize);
  await drawImage(callIcon);
  currXPos =
    width -
    styles.margin.x -
    imageWidth -
    regularTextWidth * 2 -
    styles.regularText.font.widthOfTextAtSize(data.locationPhone, styles.regularText.fontSize) -
    styles.regularText.font.widthOfTextAtSize(data.locationFax, styles.regularText.fontSize);
  drawRegularTextLeft(data.locationPhone);
  currXPos =
    width -
    styles.margin.x -
    imageWidth -
    regularTextWidth -
    styles.regularText.font.widthOfTextAtSize(data.locationFax, styles.regularText.fontSize);
  await drawImage(faxIcon);
  currXPos =
    width - styles.margin.x - styles.regularText.font.widthOfTextAtSize(data.locationFax, styles.regularText.fontSize);
  drawRegularTextLeft(data.locationFax);
  addNewLine(undefined, 2);
  drawHeader('FINAL RESULT');
  currXPos = styles.margin.x;
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Order details
  drawFieldLineLeft('Assession ID:', data.accessionNumber);
  drawFieldLineRight('Order Date:', data.orderDate);
  addNewLine();
  drawFieldLineLeft('Requesting physician:', data.providerName);
  drawFieldLineRight('Collection Date:', data.todayDate);
  addNewLine();
  drawFieldLineLeft('Ordering physician:', data.providerName);
  drawFieldLineRight('Order Printed:', data.todayDate);
  addNewLine();
  drawFieldLineLeft('Req ID:', data.reqId);
  drawFieldLineRight('Order Sent:', data.orderDate);
  addNewLine();
  drawFieldLineLeft('Order priority:', data.orderPriority.toUpperCase());
  drawFieldLineRight('Order Received:', data.orderReceived);
  addNewLine();
  drawFieldLineRight('Specimen Received', data.specimenReceived);
  addNewLine();
  drawFieldLineRight('Reported:', data.reportDate);
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Specimen details block
  drawFieldLineLeft('Specimen source:', data.specimenSource.toUpperCase());
  drawFieldLineRight('Specimen description:', data.specimenDescription);
  addNewLine();
  drawFieldLineLeft('Dx:', `${data.assessmentCode} ${`(${data.assessmentName})`}`);
  addNewLine(undefined, 3);
  drawLargeHeader(data.labType.toUpperCase());
  addNewLine(undefined, 2);
  drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  addNewLine();
  drawFiveColumnText('', 'NAME', 'VALUE', referenceRangeTitle(), 'LAB');
  addNewLine();
  drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  addNewLine();
  drawFiveColumnText(
    data.resultPhase,
    data.labType.toUpperCase(),
    data.specimenValue.toUpperCase(),
    referenceRangeText(),
    data.performingLabCode,
    styles.regularTextBold.font,
    14,
    styles.colors.red
  );
  addNewLine(undefined, 3);
  drawFreeText(data.resultBody);
  addNewLine(undefined, 1.5);
  drawSeparatorLine();
  addNewLine();

  // Performing lab details
  drawRegularTextRight(`PERFORMING LAB: ${data.performingLabCode}, ${data.performingLabName}`);
  addNewLine();
  drawRegularTextRight(
    `${data.performingLabState}, ${data.performingLabCity}, ${data.performingLabState} ${data.performingLabZip} Director: ${data.performingLabDirector}`
  );
  addNewLine();
  drawRegularTextRight(
    `${data.performingLabProviderFirstName} ${data.performingLabProviderLastName}, ${data.performingLabProviderTitle}, ${data.performingLabPhone}`
  );
  addNewLine();

  // Reviewed by
  drawSeparatorLine();
  addNewLine();
  drawFieldLineLeft(`Reviewed: ${data.reviewDate} by`, `${data.reviewingProviderTitle} ${data.reviewingProviderLast}`);

  return await pdfDoc.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsResultsFormPDF(
  input: LabResultsData,
  patient: Patient,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  if (!patient.id) {
    throw new Error('No patient id found for external lab order');
  }

  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsResultsFormPdfBytes(input).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  const fileName = 'ExternalLabsResultsForm.pdf';
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

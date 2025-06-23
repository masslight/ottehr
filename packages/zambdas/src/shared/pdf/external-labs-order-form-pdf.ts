import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { PdfInfo } from './pdf-utils';
import { LabsData } from './types';
import { Secrets } from 'utils';
import { makeZ3Url } from '../presigned-file-urls';

async function createExternalLabsOrderFormPdfBytes(data: LabsData): Promise<Uint8Array> {
  if (!data.orderName) {
    throw new Error('Order name is required');
  }
  console.log('drawing pdf for ', data.reqId, data.orderName);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { height, width } = page.getSize();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const locationIcon = './assets/location_on.png';
  const callIcon = './assets/call.png';
  const faxIcon = './assets/fax.png';

  const hadSomeAddressInfo =
    data.locationName ||
    data.locationStreetAddress ||
    data.locationCity ||
    data.locationState ||
    data.locationZip ||
    data.locationPhone ||
    data.locationFax;

  const locationCityStateZip = `${data.locationCity?.toUpperCase() || ''}${data.locationCity ? ', ' : ''}${
    data.locationState?.toUpperCase() || ''
  }${data.locationState ? ' ' : ''}${data.locationZip?.toUpperCase() || ''}`;

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
        x: currXPos + styles.regularTextBold.font.widthOfTextAtSize(fieldName, styles.regularTextBold.fontSize) + 1,
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
      maxWidth: pageTextWidth / 2 - currXPos,
    });
    page.drawText(columnTwoName, {
      font: columnTwoFont,
      size: columnTwoFontSize,
      x: pageTextWidth / 2,
      y: currYPos,
      maxWidth: pageTextWidth / 2,
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

  const addLocationPhoneInfo = async (): Promise<void> => {
    await drawImage(callIcon);
    currXPos += imageWidth + regularTextWidth;
    drawRegularTextLeft(data.locationPhone || '');
    currXPos +=
      helveticaFont.widthOfTextAtSize(data.locationPhone || '', styles.regularText.fontSize) + regularTextWidth;
  };

  const addLocationFaxInfo = async (): Promise<void> => {
    await drawImage(faxIcon);
    currXPos += imageWidth + regularTextWidth;
    data.locationFax && drawRegularTextLeft(data.locationFax);
  };

  // --- add all sections to PDF ---
  // ===============================
  // Main header
  drawHeader(`${data.labOrganizationName}: Order Form`);
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Location details
  drawSubHeader(data?.locationName || '');
  drawFieldLineRight('Req ID:', data.reqId);
  addNewLine();
  if (hadSomeAddressInfo) await drawImage(locationIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.locationStreetAddress?.toUpperCase() || '');
  drawRegularTextRight(`${data.providerName}, ${data.providerTitle}`, styles.regularTextBold.font);
  addNewLine();
  currXPos = styles.margin.x + imageWidth + regularTextWidth;
  drawRegularTextLeft(locationCityStateZip);
  drawFieldLineRight('NPI:', data.providerNPI || '');
  addNewLine();
  currXPos = styles.margin.x;
  if (data.locationPhone) await addLocationPhoneInfo();
  if (data.locationFax) await addLocationFaxInfo();
  currXPos = styles.margin.x;
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Patient details block
  drawSubHeader(`${data.patientFirstName},`);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientFirstName, styles.subHeader.fontSize) + subHeaderTextWidth;
  if (data.patientMiddleName) {
    drawSubHeader(`${data.patientMiddleName},`);
    currXPos +=
      styles.subHeader.font.widthOfTextAtSize(data.patientMiddleName, styles.subHeader.fontSize) + subHeaderTextWidth;
  }
  drawSubHeader(`${data.patientLastName},`);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientLastName, styles.subHeader.fontSize) + subHeaderTextWidth;
  drawRegularTextLeft(`${data.patientSex},`);
  currXPos += styles.subHeader.font.widthOfTextAtSize(data.patientSex, styles.regularText.fontSize) + regularTextWidth;
  drawRegularTextLeft(`${data.patientDOB},`);
  drawFieldLineRight(`Today's Date: `, data.todayDate);
  addNewLine();
  currXPos = styles.margin.x;
  drawFieldLineLeft('ID:', data.patientId);
  drawFieldLineRight('Order Create Date:', data.orderCreateDate);
  addNewLine();
  await drawImage(locationIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.patientAddress);
  currXPos +=
    styles.subHeader.font.widthOfTextAtSize(data.patientAddress, styles.regularText.fontSize) + regularTextWidth;
  await drawImage(callIcon);
  currXPos += imageWidth + regularTextWidth;
  drawRegularTextLeft(data.patientPhone);
  if (data.sampleCollectionDate) {
    drawFieldLineRight('Sample Collection Date:  ', data.sampleCollectionDate);
    addNewLine();
  }
  drawFieldLineRight('Order Submit Date: ', data.orderSubmitDate);
  currXPos = styles.margin.x;
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Insurance details, conditionally displayed
  if (data.primaryInsuranceName) {
    drawFieldLineLeft('Primary Insurance Name:', data.primaryInsuranceName.toUpperCase());
    addNewLine();
  }
  if (data.primaryInsuranceAddress) {
    drawFieldLineLeft('Insurance Address:', data.primaryInsuranceAddress.toUpperCase());
    addNewLine();
  }
  if (data.primaryInsuranceSubNum) {
    drawFieldLineLeft('Subscriber Number:', data.primaryInsuranceSubNum);
    addNewLine();
  }
  if (data.insuredName) {
    drawFieldLineLeft('Insured Name:', data.insuredName);
    addNewLine();
  }
  if (data.insuredAddress) {
    drawFieldLineLeft('Address:', data.insuredAddress);
    addNewLine();
  }
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
  if (data.aoeAnswers?.length) {
    drawSubHeader('AOE Answers');
    addNewLine();
    data.aoeAnswers.forEach((item) => {
      drawFieldLineLeft(`${item.question}: `, item.answer.toString());
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
    data.orderName.toUpperCase(),
    styles.subHeader.font,
    styles.subHeader.fontSize,
    data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', '),
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
  const fileName = 'ExternalLabsOrderForm.pdf';
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

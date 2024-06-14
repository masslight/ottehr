import { WorkSchoolNoteExcuseDocDTO, Secrets, PdfBulletPointItem } from 'ehr-utils';
import { Patient } from 'fhir/r4';
import { getSecret, SecretsKeys } from '../secrets';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { PdfInfo, createBaseFileUrl, handleBadSpaces, splitLongStringToPageSize } from './pdfUtils';
import { Color, rgb, PageSizes, PDFDocument, PDFFont } from 'pdf-lib';
import fs from 'fs';

export async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

async function createPdfBytes(data: WorkSchoolNoteExcuseDocDTO): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { height, width } = page.getSize();
  const dancingSignatureFont = await pdfDoc.embedFont(fs.readFileSync('./DancingScript-Regular.otf'));
  const pmDiatypeFont = await pdfDoc.embedFont(fs.readFileSync('./PMDiatype-Regular.otf'));
  const pmDiatypeFontBold = await pdfDoc.embedFont(fs.readFileSync('./PMDiatype-Bold.otf'));
  const rgbNormalized = (r: number, g: number, b: number): Color => rgb(r / 255, g / 255, b / 255);
  const styles = {
    image: {
      width: 110,
      height: 28,
    },
    header: {
      font: pmDiatypeFontBold,
      fontSize: 20,
    },
    regularText: {
      font: pmDiatypeFont,
      fontSize: 16,
    },
    digitalSign: {
      font: dancingSignatureFont,
      fontSize: 22,
    },
    spacing: {
      image: 65,
      regularText: 2,
      header: 25,
      paragraph: 3,
      block: 60,
    },
    margin: {
      x: 40,
      y: 40,
      bulletList: 9,
      bulletItem: 45,
    },
    color: {
      grey: rgbNormalized(143, 154, 167),
    },
  };
  // Start at the top of the page then move down as elements are added to the PDF.
  let currYPos = height - styles.margin.y; // top of page. Content starts after this point
  let currXPos = styles.margin.x;
  const pageTextWidth = width - styles.margin.x * 2;

  const drawText = (text: string, font: PDFFont, fontSize: number, color?: Color): void => {
    const currentTextSize = font.heightAtSize(fontSize);
    splitLongStringToPageSize(text, font, fontSize, pageTextWidth).forEach((line) => {
      page.drawText(line, {
        font: font,
        size: fontSize,
        x: currXPos,
        y: currYPos,
        color,
      });
      currYPos -= currentTextSize + styles.spacing.regularText;
    });
  };

  const drawHeader = (text: string): void => {
    drawText(text, styles.header.font, styles.header.fontSize);
    currYPos -= styles.spacing.header; // space between header and first detail
  };

  const drawRegularText = (text: string, color?: Color): void => {
    drawText(text, styles.regularText.font, styles.regularText.fontSize, color);
    currYPos -= styles.spacing.regularText;
  };

  const drawDigitalSign = (text: string): void => {
    drawText(text, styles.digitalSign.font, styles.digitalSign.fontSize);
    currYPos -= styles.spacing.regularText;
  };

  const drawBullets = (bullets: PdfBulletPointItem[], nestedPosition: number): void => {
    bullets.forEach((bullet) => {
      const bulletText = '\u2022  ' + handleBadSpaces(bullet.text);
      currXPos += nestedPosition * styles.margin.bulletItem;
      drawText(bulletText, styles.regularText.font, styles.regularText.fontSize);
      currXPos -= nestedPosition * styles.margin.bulletItem;
      currYPos -= styles.spacing.regularText;
      if (bullet.subItems) drawBullets(bullet.subItems, nestedPosition + 1);
    });
  };

  // add PM Pediatrics logo at the top of the PDF
  const imgPath = './pmLogo.png';
  const imgBytes = fs.readFileSync(imgPath);
  const img = await pdfDoc.embedPng(imgBytes);
  currYPos -= styles.margin.y;
  page.drawImage(img, {
    x: styles.margin.x,
    y: currYPos,
    width: styles.image.width,
    height: styles.image.height,
  });
  currYPos -= styles.image.height + styles.spacing.image; // space after image

  // add all sections to PDF
  if (data.documentHeader) drawHeader(data.documentHeader);
  if (data.headerNote) drawRegularText(data.headerNote);
  currYPos -= styles.spacing.paragraph;
  currXPos += styles.margin.bulletList;
  if (data.bulletItems) drawBullets(data.bulletItems, 0);
  currXPos -= styles.margin.bulletList;
  currYPos -= styles.spacing.paragraph;
  if (data.footerNote) drawRegularText(data.footerNote);
  currYPos -= styles.spacing.block;
  if (data.providerDetails) {
    drawRegularText('Electronically signed by: ', styles.color.grey);
    drawDigitalSign(data.providerDetails.name);
    drawRegularText(data.providerDetails.credentials);
  }

  return await pdfDoc.save();
}

export async function createWorkSchoolNotePDF(
  input: WorkSchoolNoteExcuseDocDTO,
  patient: Patient,
  secrets: Secrets | null,
  token: string,
): Promise<PdfInfo> {
  console.log('Creating consent PDFs');
  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }

  const pdfBytes = await createPdfBytes(input).catch((error) => {
    throw new Error('failed creating pdfBytes: ' + error.message);
  });
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const bucket = `${environment}-work-school-note`;
  const fileName = 'WorkSchoolNote.pdf';
  const baseFileUrl = createBaseFileUrl(secrets, fileName, bucket);
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

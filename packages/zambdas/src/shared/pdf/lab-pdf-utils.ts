import fs from 'node:fs';
import { Color, PDFFont, PDFImage, StandardFonts } from 'pdf-lib';
import {
  HEADER_FONT_SIZE,
  PDF_CLIENT_STYLES,
  STANDARD_FONT_SIZE,
  STANDARD_FONT_SPACING,
  SUB_HEADER_FONT_SIZE,
} from './pdf-consts';
import { createPdfClient, rgbNormalized } from './pdf-utils';
import { PdfClient, PdfClientStyles, TextStyle } from './types';

export type LabsPDFTextStyleConfig = Record<string, TextStyle>;

export const LAB_PDF_STYLES = {
  color: {
    red: rgbNormalized(255, 0, 0),
    purple: rgbNormalized(77, 21, 183),
    black: rgbNormalized(0, 0, 0),
    grey: rgbNormalized(102, 102, 102),
  },
};

export async function getPdfClientForLabsPDFs(): Promise<{
  pdfClient: PdfClient;
  callIcon: PDFImage;
  faxIcon: PDFImage;
  locationIcon: PDFImage;
  textStyles: LabsPDFTextStyleConfig;
  initialPageStyles: PdfClientStyles;
}> {
  const initialPageStyles = PDF_CLIENT_STYLES;
  const pdfClient = await createPdfClient(initialPageStyles);
  const textStyles = await getTextStylesForLabsPDF(pdfClient);

  const callIcon = await pdfClient.embedImage(fs.readFileSync('./assets/call.png'));
  const faxIcon = await pdfClient.embedImage(fs.readFileSync('./assets/fax.png'));
  const locationIcon = await pdfClient.embedImage(fs.readFileSync('./assets/location_on.png'));

  return { pdfClient, callIcon, faxIcon, locationIcon, textStyles, initialPageStyles };
}

export async function getTextStylesForLabsPDF(pdfClient: PdfClient): Promise<LabsPDFTextStyleConfig> {
  let fontRegular: PDFFont;
  let fontBold: PDFFont;

  try {
    fontRegular = await pdfClient.embedFont(fs.readFileSync('./assets/AtkinsonHyperlegibleMono-Regular.ttf'));
    fontBold = await pdfClient.embedFont(fs.readFileSync('./assets/AtkinsonHyperlegibleMono-Bold.ttf'));
    console.log('Using AtkinsonHyperlegibleMono font');
  } catch (e) {
    console.warn('Font not available. Defaulting to Courier', e);
    fontRegular = await pdfClient.embedStandardFont(StandardFonts.Courier);
    fontBold = await pdfClient.embedStandardFont(StandardFonts.CourierBold);
  }

  const textStyles: Record<string, TextStyle> = {
    blockHeader: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: STANDARD_FONT_SPACING,
      font: fontBold,
      newLineAfter: true,
    },
    header: {
      fontSize: HEADER_FONT_SIZE,
      spacing: STANDARD_FONT_SPACING,
      font: fontBold,
      color: LAB_PDF_STYLES.color.purple,
      newLineAfter: true,
    },
    headerRight: {
      fontSize: HEADER_FONT_SIZE,
      spacing: STANDARD_FONT_SPACING,
      font: fontBold,
      side: 'right',
      color: LAB_PDF_STYLES.color.purple,
    },
    subHeaderRight: {
      fontSize: SUB_HEADER_FONT_SIZE,
      spacing: STANDARD_FONT_SPACING,
      font: fontBold,
      side: 'right',
      color: LAB_PDF_STYLES.color.grey,
    },
    fieldHeader: {
      fontSize: STANDARD_FONT_SIZE,
      font: fontRegular,
      spacing: 1,
    },
    fieldHeaderRight: {
      fontSize: STANDARD_FONT_SIZE,
      font: fontRegular,
      spacing: 1,
      side: 'right',
    },
    text: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontRegular,
    },
    textBold: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontBold,
    },
    textBoldRight: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontBold,
      side: 'right',
    },
    textRight: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontRegular,
      side: 'right',
    },
    fieldText: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontRegular,
      side: 'right',
      newLineAfter: true,
    },
    textGrey: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontRegular,
      color: LAB_PDF_STYLES.color.grey,
    },
    textGreyBold: {
      fontSize: STANDARD_FONT_SIZE,
      spacing: 6,
      font: fontBold,
      color: LAB_PDF_STYLES.color.grey,
    },
    pageNumber: {
      fontSize: 10,
      spacing: 6,
      font: fontRegular,
      color: LAB_PDF_STYLES.color.grey,
      side: 'right',
    },
    pageHeaderGreyBold: {
      fontSize: STANDARD_FONT_SIZE - 4,
      spacing: 6,
      font: fontBold,
      color: LAB_PDF_STYLES.color.grey,
    },
    pageHeaderGrey: {
      fontSize: STANDARD_FONT_SIZE - 4,
      spacing: 6,
      font: fontRegular,
      color: LAB_PDF_STYLES.color.grey,
    },
  };
  return textStyles;
}

export const drawFieldLine = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  fieldName: string,
  fieldValue: string
): PdfClient => {
  pdfClient.drawTextSequential(fieldName, textStyles.text);
  pdfClient.drawTextSequential(' ', textStyles.textBold);
  pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
  return pdfClient;
};

export const drawFieldLineBoldHeader = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  fieldName: string,
  fieldValue: string
): PdfClient => {
  pdfClient.drawTextSequential(fieldName, textStyles.textBold);
  pdfClient.drawTextSequential(' ', textStyles.text);
  pdfClient.drawTextSequential(fieldValue, textStyles.text);
  return pdfClient;
};

export const drawFieldLineRight = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  fieldName: string,
  fieldValue: string
): PdfClient => {
  pdfClient.drawStartXPosSpecifiedText(fieldName, textStyles.text, 285);
  pdfClient.drawTextSequential(' ', textStyles.textBold);
  pdfClient.drawTextSequential(fieldValue, textStyles.textBold, {
    leftBound: pdfClient.getX(),
    rightBound: pdfClient.getRightBound(),
  });
  return pdfClient;
};

export const drawFourColumnText = (
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  columnOne: { name: string; startXPos: number; isBold?: boolean },
  columnTwo: { name: string; startXPos: number; isBold?: boolean },
  columnThree: { name: string; startXPos: number; isBold?: boolean },
  columnFour: { name: string; startXPos: number; isBold?: boolean },
  color?: Color
): PdfClient => {
  const fontSize = STANDARD_FONT_SIZE;
  const fontStyleTemp = { fontSize: fontSize, color: color };
  pdfClient.drawStartXPosSpecifiedText(
    columnOne.name,
    { ...(columnOne.isBold ? textStyles.textBold : textStyles.text), ...fontStyleTemp },
    columnOne.startXPos
  );
  pdfClient.drawStartXPosSpecifiedText(
    columnTwo.name,
    { ...(columnTwo.isBold ? textStyles.textBold : textStyles.text), ...fontStyleTemp },
    columnTwo.startXPos
  );
  pdfClient.drawStartXPosSpecifiedText(
    columnThree.name,
    { ...(columnThree.isBold ? textStyles.textBold : textStyles.text), ...fontStyleTemp },
    columnThree.startXPos
  );
  pdfClient.drawStartXPosSpecifiedText(
    columnFour.name,
    { ...(columnFour.isBold ? textStyles.textBold : textStyles.text), ...fontStyleTemp },
    columnFour.startXPos
  );
  return pdfClient;
};

export const LABS_PDF_LEFT_INDENTATION_XPOS = 50;

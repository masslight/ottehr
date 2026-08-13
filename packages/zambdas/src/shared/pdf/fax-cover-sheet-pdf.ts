import { HIPAA_FAX_CONFIDENTIALITY_STATEMENT } from 'utils/lib/types/api/fax.types';
import { loadPdfAssets, StyleFactory } from './pdf-common';
import { PDF_CLIENT_STYLES } from './pdf-consts';
import { createPdfClient, rgbNormalized } from './pdf-utils';
import { AssetPaths, FaxCoverSheetData, PdfClient, PdfStyles } from './types';

/** Same logo box the other generated documents use (see `progress-note-pdf.ts`). */
const LOGO_MAX_WIDTH = 110;
const LOGO_MAX_HEIGHT = 28;
/** Vertical drop after the logo — `drawImage` grows upward from the cursor, so this clears it. */
const LOGO_BOTTOM_GAP = 22;
/** Gutter between the To/From columns. */
const COLUMN_GAP = 20;
/** Space above the footer line. */
const FOOTER_TOP_GAP = 24;

const faxCoverSheetAssetPaths: AssetPaths = {
  fonts: {
    regular: './assets/Rubik-Regular.otf',
    bold: './assets/Rubik-Medium.ttf',
  },
};

/**
 * Style keys are resolved by string at render time and are NOT type-checked, so this factory must
 * define every key referenced below. Do not rely on keys defined by other documents.
 */
const createFaxCoverSheetStyles: StyleFactory = (assets) => ({
  textStyles: {
    title: {
      fontSize: 18,
      font: assets.fonts.bold,
      spacing: 6,
      newLineAfter: true,
    },
    bold: {
      fontSize: 12,
      font: assets.fonts.bold,
      spacing: 4,
      newLineAfter: true,
    },
    regular: {
      fontSize: 12,
      font: assets.fonts.regular,
      spacing: 4,
      newLineAfter: true,
    },
    confidentiality: {
      fontSize: 10,
      font: assets.fonts.regular,
      color: rgbNormalized(68, 68, 68),
      spacing: 4,
      newLineAfter: true,
    },
    footerLeft: {
      fontSize: 9,
      font: assets.fonts.regular,
      color: rgbNormalized(128, 128, 128),
      spacing: 2,
      newLineAfter: false,
    },
    footerRight: {
      fontSize: 9,
      font: assets.fonts.regular,
      color: rgbNormalized(128, 128, 128),
      side: 'right',
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

const buildRecipientLines = (data: FaxCoverSheetData): string[] => {
  const { recipient } = data;
  const lines: string[] = [];
  if (recipient.name) lines.push(recipient.name);
  if (recipient.organization) lines.push(recipient.organization);
  lines.push(`Fax: ${recipient.faxNumber}`);
  if (recipient.phoneNumber) lines.push(`Phone: ${recipient.phoneNumber}`);
  return lines;
};

const buildSenderLines = (data: FaxCoverSheetData): string[] => {
  const { sender } = data;
  const lines: string[] = [];
  if (sender.organizationName) lines.push(sender.organizationName);
  if (sender.addressText) lines.push(sender.addressText);
  if (sender.faxNumber) lines.push(`Fax: ${sender.faxNumber}`);
  if (sender.phoneNumber) lines.push(`Phone: ${sender.phoneNumber}`);
  if (sender.practitionerName) {
    lines.push(
      sender.npi ? `Sender: ${sender.practitionerName}, NPI: ${sender.npi}` : `Sender: ${sender.practitionerName}`
    );
  }
  return lines;
};

const formatPageCount = (totalPages: number): string => `${totalPages} ${totalPages === 1 ? 'page' : 'pages'}`;

/**
 * Renders the two side-by-side To/From blocks and leaves the cursor below the taller of the two.
 * Bounds are restored before returning.
 */
const drawTwoColumnBlock = (
  pdfClient: PdfClient,
  styles: PdfStyles,
  leftLines: string[],
  rightLines: string[]
): void => {
  const originalLeft = pdfClient.getLeftBound();
  const originalRight = pdfClient.getRightBound();
  const columnWidth = (originalRight - originalLeft - COLUMN_GAP) / 2;
  const startY = pdfClient.getY();

  const drawColumn = (leftBound: number, rightBound: number, lines: string[]): number => {
    pdfClient.setLeftBound(leftBound);
    pdfClient.setRightBound(rightBound);
    pdfClient.setY(startY);
    lines.forEach((line, index) => {
      pdfClient.drawText(line, index === 0 ? styles.textStyles.bold : styles.textStyles.regular);
    });
    return pdfClient.getY();
  };

  const leftEndY = drawColumn(originalLeft, originalLeft + columnWidth, ['To:', ...leftLines]);
  const rightEndY = drawColumn(originalRight - columnWidth, originalRight, ['From:', ...rightLines]);

  pdfClient.setLeftBound(originalLeft);
  pdfClient.setRightBound(originalRight);
  // Y decreases going down the page, so the point below both columns is the smaller value.
  pdfClient.setY(Math.min(leftEndY, rightEndY));
};

/**
 * Builds the cover sheet that becomes page 1 of an outbound fax packet and returns the raw PDF
 * bytes. Deliberately performs no upload: the caller merges these bytes with the visit documents
 * and uploads the merged packet once.
 */
export async function createFaxCoverSheetPdfBytes(data: FaxCoverSheetData): Promise<Uint8Array> {
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const assets = await loadPdfAssets(pdfClient, faxCoverSheetAssetPaths);
  const styles = createFaxCoverSheetStyles(assets);

  if (assets.logo) {
    const { width, height } = assets.logo.scaleToFit(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT);
    pdfClient.drawImage(assets.logo, { width, height });
    pdfClient.newLine(LOGO_BOTTOM_GAP);
  }

  const { subject } = data;
  const title = subject.visitTypeLabel ? `${subject.visitTypeLabel} of ${subject.patientName}` : subject.patientName;
  pdfClient.drawText(title, styles.textStyles.title);
  pdfClient.drawText(`PID: ${subject.patientId}`, styles.textStyles.regular);
  // A packet that is not about one visit has no visit to identify or date.
  if (subject.visitId) pdfClient.drawText(`VID: ${subject.visitId}`, styles.textStyles.regular);
  if (subject.dateOfService) pdfClient.drawText(`DOS: ${subject.dateOfService}`, styles.textStyles.regular);

  pdfClient.drawSeparatedLine(styles.lineStyles.separator);

  drawTwoColumnBlock(pdfClient, styles, buildRecipientLines(data), buildSenderLines(data));

  pdfClient.drawSeparatedLine(styles.lineStyles.separator);

  pdfClient.drawText(HIPAA_FAX_CONFIDENTIALITY_STATEMENT, styles.textStyles.confidentiality);

  pdfClient.newLine(FOOTER_TOP_GAP);
  pdfClient.drawText(formatPageCount(data.totalPages), styles.textStyles.footerLeft);
  pdfClient.drawText(data.generatedAt, styles.textStyles.footerRight);

  return await pdfClient.save();
}

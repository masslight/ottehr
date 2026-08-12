import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { PageSizes, PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { FaxRecipient } from 'utils/lib/types/api/fax.types';
import { getPdfLogo, handleBadSpaces, rgbNormalized, splitLongStringToPageSize } from '../pdf/pdf-utils';

/** The practice this fax is sent on behalf of, resolved from the configured Organization. */
export interface FaxSender {
  organizationName: string;
  address?: string;
  faxNumber?: string;
  phoneNumber?: string;
  /** Staff member who requested the fax. */
  senderName?: string;
}

export interface FaxCoverPageInfo {
  /** e.g. "Medical Record of Black, Oliver". */
  title: string;
  /** Identifier lines rendered under the title, e.g. ["PID: 1234", "DOS: 05/05/2026"]. */
  identifiers: string[];
  recipient: FaxRecipient;
  sender: FaxSender;
  /** Pages in the whole transmission, cover included. */
  pageCount: number;
  /** Already formatted in the practice's timezone. */
  generatedAt: string;
}

/**
 * Fonts and logo are read from disk / fetched over the network, but pdf-lib embeds are scoped to a
 * single document. Loading the bytes once and embedding them per document keeps a fax to one read.
 */
export interface FaxCoverAssets {
  regularFont: Buffer;
  boldFont: Buffer;
  logo?: Buffer;
}

export interface FaxCoverLayout {
  recipientBottom: number;
  senderBottom: number;
  partyBottom: number;
}

const DISCLAIMER =
  'This fax contains protected health information (PHI) intended solely for the named recipient. ' +
  'If you received this in error, please notify us immediately at the phone number provided and destroy ' +
  'all copies. Unauthorized use, disclosure, or copying is strictly prohibited.';

const MARGIN = 50;
const LOGO_HEIGHT = 30;
const TITLE_SIZE = 18;
const HEADING_SIZE = 12;
const BODY_SIZE = 11;
const FOOTER_SIZE = 9;
const LINE_GAP = 5;

const GREY = rgbNormalized(102, 102, 102);
const RULE_COLOR = rgbNormalized(214, 214, 214);

export const loadFaxCoverAssets = async (): Promise<FaxCoverAssets> => ({
  regularFont: fs.readFileSync('./assets/Rubik-Regular.otf'),
  boldFont: fs.readFileSync('./assets/Rubik-Bold.otf'),
  logo: await getPdfLogo(),
});

/** Appends the cover sheet to `pdfDoc` as a single page. */
export const drawFaxCoverPage = async (
  pdfDoc: PDFDocument,
  info: FaxCoverPageInfo,
  assets: FaxCoverAssets
): Promise<FaxCoverLayout> => {
  pdfDoc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdfDoc.embedFont(new Uint8Array(assets.regularFont)),
    pdfDoc.embedFont(new Uint8Array(assets.boldFont)),
  ]);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const contentWidth = width - MARGIN * 2;
  let y = height - MARGIN;

  const drawLines = (text: string, font: PDFFont, size: number, x: number, maxWidth: number): void => {
    splitLongStringToPageSize(handleBadSpaces(text), font, size, maxWidth).forEach((line) => {
      y -= font.heightAtSize(size);
      page.drawText(line, { x, y, font, size });
      y -= LINE_GAP;
    });
  };

  if (assets.logo) {
    const image = await pdfDoc.embedPng(new Uint8Array(assets.logo));
    const scale = Math.min(1, LOGO_HEIGHT / image.height);
    y -= image.height * scale;
    page.drawImage(image, { x: MARGIN, y, width: image.width * scale, height: image.height * scale });
    y -= 50;
  }

  drawLines(info.title, bold, TITLE_SIZE, MARGIN, contentWidth);
  y -= 4;
  info.identifiers.forEach((identifier) => {
    y -= regular.heightAtSize(BODY_SIZE);
    page.drawText(identifier, { x: MARGIN, y, font: regular, size: BODY_SIZE, color: GREY });
    y -= LINE_GAP;
  });

  y -= 16;
  drawRule(page, y, width);
  y -= 24;

  const columnWidth = contentWidth / 2 - 10;
  const columnTop = y;
  const recipientBottom = drawParty(
    page,
    { x: MARGIN, top: columnTop, width: columnWidth },
    'To:',
    recipientLines(info.recipient),
    { regular, bold }
  );
  const senderBottom = drawParty(
    page,
    { x: MARGIN + contentWidth / 2, top: columnTop, width: columnWidth },
    'From:',
    senderLines(info.sender),
    { regular, bold }
  );
  const partyBottom = Math.min(recipientBottom, senderBottom);
  y = partyBottom;

  y -= 20;
  drawRule(page, y, width);
  y -= 22;
  drawLines(DISCLAIMER, regular, BODY_SIZE, MARGIN, contentWidth);

  const footerY = MARGIN;
  const pageLabel = `${info.pageCount} ${info.pageCount === 1 ? 'page' : 'pages'}`;
  page.drawText(pageLabel, { x: MARGIN, y: footerY, font: regular, size: FOOTER_SIZE, color: GREY });
  const generatedWidth = regular.widthOfTextAtSize(info.generatedAt, FOOTER_SIZE);
  page.drawText(info.generatedAt, {
    x: width - MARGIN - generatedWidth,
    y: footerY,
    font: regular,
    size: FOOTER_SIZE,
    color: GREY,
  });

  return { recipientBottom, senderBottom, partyBottom };
};

const drawRule = (page: PDFPage, y: number, width: number): void => {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 1,
    color: RULE_COLOR,
  });
};

/** Draws a "To:"/"From:" block and returns the y position it ended at. */
const drawParty = (
  page: PDFPage,
  column: { x: number; top: number; width: number },
  heading: string,
  lines: string[],
  fonts: { regular: PDFFont; bold: PDFFont }
): number => {
  let y = column.top;
  const write = (text: string, font: PDFFont, size: number): void => {
    splitLongStringToPageSize(handleBadSpaces(text), font, size, column.width).forEach((line) => {
      y -= font.heightAtSize(size);
      page.drawText(line, { x: column.x, y, font, size });
      y -= LINE_GAP;
    });
  };

  write(heading, fonts.bold, HEADING_SIZE);
  y -= 6;
  const [primary, ...rest] = lines;
  if (primary) write(primary, fonts.bold, HEADING_SIZE);
  rest.forEach((line) => write(line, fonts.regular, BODY_SIZE));
  return y;
};

const recipientLines = (recipient: FaxRecipient): string[] =>
  [
    recipient.name,
    recipient.organization,
    `Fax: ${formatPhoneNumberDisplay(recipient.faxNumber)}`,
    recipient.phoneNumber ? `Phone: ${formatPhoneNumberDisplay(recipient.phoneNumber)}` : undefined,
  ].filter((line): line is string => Boolean(line));

const senderLines = (sender: FaxSender): string[] =>
  [
    sender.organizationName,
    sender.address,
    sender.faxNumber ? `Fax: ${formatPhoneNumberDisplay(sender.faxNumber)}` : undefined,
    sender.phoneNumber ? `Phone: ${formatPhoneNumberDisplay(sender.phoneNumber)}` : undefined,
    sender.senderName ? `Sender: ${sender.senderName}` : undefined,
  ].filter((line): line is string => Boolean(line));

import { CandidApi } from 'candidhealth';
import { Color, PageSizes, PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions, StandardFonts } from 'pdf-lib';
import { assertDefined } from '../../shared/helpers';
import { rgbNormalized } from '../../shared/pdf/pdf-utils';

const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const DEFAULT_MARGIN = 25;
const PAGE_CONTENT_BOTTOM_MARGIN = 50;
const PATIENT_NAME_FONT_SIZE = 18;
const PID_FONT_SIZE = 12;
const SECTION_TITLE_FONT_SIZE = 16;
const SECTION_TITLE_MARGIN = 10;
const SECTION_BOTTOM_MARGIN = 20;
const DIVIDER_LINE_THICKNESS = 1;
const DIVIDER_LINE_COLOR = rgbNormalized(0xdf, 0xe5, 0xe9);
const PATIENT_INFO_DIVIDER_MARGIN = 16;
const ITEM_DIVIDER_MARGIN = 8;
const ITEM_WIDTH = (PAGE_WIDTH - DEFAULT_MARGIN * 3) / 2;
const ITEM_FONT_SIZE = 12;
const ITEM_MAX_CHARS_PER_LINE = 25;
const IMAGE_MAX_HEIGHT = PAGE_HEIGHT / 4;
const PAGE_NUMBER_COLOR = rgbNormalized(0x66, 0x66, 0x66);
const PAGE_NUMBER_FONT_SIZE = 10;

export async function generatePdf(serviceLines: CandidApi.patientAr.v1.ServiceLineItemization[]): Promise<PDFDocument> {
  const pdfDocument = await PDFDocument.create();
  const helveticaFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);

  const firstPage = pdfDocument.addPage();
  firstPage.setSize(PAGE_WIDTH, PAGE_HEIGHT);
  drawPageNumbers(pdfDocument, helveticaFont);
  return pdfDocument;
}

function drawPageNumbers(pdfDocument: PDFDocument, font: PDFFont): void {
  pdfDocument.getPages().forEach((page, index) => {
    drawTextLeftAligned(`Page ${index + 1} of ${pdfDocument.getPageCount()}`, page, {
      x: DEFAULT_MARGIN,
      y: DEFAULT_MARGIN + font.heightAtSize(PAGE_NUMBER_FONT_SIZE),
      font,
      color: PAGE_NUMBER_COLOR,
      size: PAGE_NUMBER_FONT_SIZE,
    });
  });
}

function drawTextLeftAligned(text: string, page: PDFPage, options: PDFPageDrawTextOptions): number {
  const font = assertDefined(options.font, 'options.font');
  const fontSize = assertDefined(options.size, 'options.size');
  const optionsY = assertDefined(options.y, 'options.y');
  const y = optionsY - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
  page.drawText(text, {
    ...options,
    y,
  });
  return optionsY - font.heightAtSize(fontSize) * ((text.match(/\n/g) || []).length + 1);
}

function drawTextRightAligned(text: string, page: PDFPage, options: PDFPageDrawTextOptions): number {
  const lines = text.split('\n');
  const font = assertDefined(options.font, 'options.font');
  const fontSize = assertDefined(options.size, 'options.size');
  const x = assertDefined(options.x, 'options.x');
  const optionsY = assertDefined(options.y, 'options.y');
  let y = optionsY - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
  for (const line of lines) {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      ...options,
      x: x - lineWidth,
      y: y,
    });
    y -= font.heightAtSize(fontSize);
  }
  return optionsY - font.heightAtSize(fontSize) * lines.length;
}

function drawLine(
  line: { x: number; y: number; width: number; thickness: number; color: Color; margin: number },
  page: PDFPage
): number {
  page.drawLine({
    color: line.color,
    thickness: line.thickness,
    start: { x: line.x, y: line.y - line.margin },
    end: { x: line.x + line.width, y: line.y - line.margin },
  });
  return line.y - line.margin * 2 + line.thickness;
}

function splitOnLines(text: string, maxCharsPerLine: number): string {
  const words = text.split(' ').flatMap((word) => {
    if (word.length < maxCharsPerLine) {
      return [word];
    }
    let segmentStart = 0;
    let restLength = word.length;
    const segments = [];
    while (restLength > 0) {
      segments.push(word.substring(segmentStart, Math.min(segmentStart + maxCharsPerLine, word.length)));
      segmentStart += maxCharsPerLine;
      restLength -= maxCharsPerLine;
    }
    return segments;
  });
  const lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (currentLine.length + word.length < maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines.join('\n');
}

function getNextPage(page: PDFPage): PDFPage {
  const pdfDocument = page.doc;
  const currentPageIndex = getPageIndex(page);
  if (currentPageIndex === pdfDocument.getPageCount() - 1) {
    const page = pdfDocument.addPage();
    page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
    return page;
  }
  return pdfDocument.getPage(currentPageIndex + 1);
}

function getPageIndex(page: PDFPage): number {
  return page.doc.getPages().indexOf(page);
}

function calculateTextHeight(text: string, options: { font: PDFFont; fontSize: number }): number {
  return options.font.heightAtSize(options.fontSize) * ((text.match(/\n/g) || []).length + 1);
}

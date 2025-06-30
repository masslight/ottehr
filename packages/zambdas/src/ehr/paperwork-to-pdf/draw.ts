import { Color, PageSizes, PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions, StandardFonts } from 'pdf-lib';
import { assertDefined } from '../../shared/helpers';
import { rgbNormalized } from '../../shared/pdf/pdf-utils';
import { Document, ImageItem, ImageType, Item, PatientInfo, Section } from './document';

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

export async function generatePdf(document: Document): Promise<PDFDocument> {
  const pdfDocument = await PDFDocument.create();
  const helveticaFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);

  const firstPage = pdfDocument.addPage();
  firstPage.setSize(PAGE_WIDTH, PAGE_HEIGHT);

  const y = drawPatientInfo(
    document.patientInfo,
    firstPage,
    PAGE_HEIGHT - DEFAULT_MARGIN,
    helveticaBoldFont,
    helveticaFont
  );
  drawSections(document.sections, firstPage, y, helveticaBoldFont, helveticaFont);
  await drawImageItems(document.imageItems, pdfDocument, helveticaFont);
  drawPageNumbers(pdfDocument, helveticaFont);
  return pdfDocument;
}

function drawPatientInfo(
  patientInfo: PatientInfo,
  page: PDFPage,
  y: number,
  patientNameFont: PDFFont,
  pidFont: PDFFont
): number {
  y = drawTextLeftAligned(patientInfo.name, page, {
    x: DEFAULT_MARGIN,
    y,
    font: patientNameFont,
    size: PATIENT_NAME_FONT_SIZE,
  });
  y = drawTextLeftAligned(`PID: ${patientInfo.id}`, page, {
    x: DEFAULT_MARGIN,
    y,
    font: pidFont,
    size: PID_FONT_SIZE,
  });
  y = drawLine(
    {
      x: DEFAULT_MARGIN,
      y,
      width: PAGE_WIDTH - DEFAULT_MARGIN * 2,
      thickness: DIVIDER_LINE_THICKNESS,
      color: DIVIDER_LINE_COLOR,
      margin: PATIENT_INFO_DIVIDER_MARGIN,
    },
    page
  );
  return y;
}

function drawSections(sections: Section[], page: PDFPage, y: number, titleFont: PDFFont, itemFont: PDFFont): void {
  let leftRowPage = page;
  let leftRowY = y;
  let rightRowPage = page;
  let rightRowY = y;
  for (const section of sections) {
    const leftRowPageIndex = getPageIndex(leftRowPage);
    const rightRowPageIndex = getPageIndex(rightRowPage);
    if (leftRowPageIndex < rightRowPageIndex || (leftRowPageIndex === rightRowPageIndex && leftRowY >= rightRowY)) {
      const [pageAfterSectionDraw, yAfterSectionDraw] = drawSection(
        section,
        leftRowPage,
        DEFAULT_MARGIN,
        leftRowY,
        titleFont,
        itemFont
      );
      leftRowPage = pageAfterSectionDraw;
      leftRowY = yAfterSectionDraw;
    } else {
      const [pageAfterSectionDraw, yAfterSectionDraw] = drawSection(
        section,
        rightRowPage,
        DEFAULT_MARGIN * 2 + ITEM_WIDTH,
        rightRowY,
        titleFont,
        itemFont
      );
      rightRowPage = pageAfterSectionDraw;
      rightRowY = yAfterSectionDraw;
    }
  }
}

function drawSection(
  section: Section,
  page: PDFPage,
  x: number,
  y: number,
  titleFont: PDFFont,
  itemFont: PDFFont
): [PDFPage, number] {
  const [pageAfterSectionTitleDraw, yAfterSectionTitleDraw] = drawSectionTitle(section.title, page, x, y, titleFont);
  page = pageAfterSectionTitleDraw;
  y = yAfterSectionTitleDraw;
  for (const item of section.items) {
    const [pageAfterItemDraw, yAfterItemDraw] = drawItem(item, page, x, y, itemFont);
    page = pageAfterItemDraw;
    y = yAfterItemDraw;
    y = drawLine(
      {
        x,
        y,
        width: ITEM_WIDTH,
        thickness: DIVIDER_LINE_THICKNESS,
        color: DIVIDER_LINE_COLOR,
        margin: ITEM_DIVIDER_MARGIN,
      },
      page
    );
  }
  return [page, y - SECTION_BOTTOM_MARGIN];
}

function drawSectionTitle(title: string, page: PDFPage, x: number, y: number, font: PDFFont): [PDFPage, number] {
  const lines = splitOnLines(title, 30);
  const height = calculateTextHeight(lines, { font: font, fontSize: SECTION_TITLE_FONT_SIZE });
  if (y - height < PAGE_CONTENT_BOTTOM_MARGIN) {
    page = getNextPage(page);
    y = PAGE_HEIGHT - DEFAULT_MARGIN;
  }
  y = drawTextLeftAligned(lines, page, {
    x,
    y,
    font: font,
    size: SECTION_TITLE_FONT_SIZE,
  });
  y -= SECTION_TITLE_MARGIN;
  return [page, y];
}

function drawItem(item: Item, page: PDFPage, x: number, y: number, font: PDFFont): [PDFPage, number] {
  const { question, answer } = item;
  const questionLines = splitOnLines(question, ITEM_MAX_CHARS_PER_LINE);
  const answerLines = splitOnLines(answer, ITEM_MAX_CHARS_PER_LINE);

  const questionHeight = calculateTextHeight(questionLines, { font: font, fontSize: ITEM_FONT_SIZE });
  const answerHeight = calculateTextHeight(answerLines, { font: font, fontSize: ITEM_FONT_SIZE });
  if (y - Math.max(questionHeight, answerHeight) < PAGE_CONTENT_BOTTOM_MARGIN) {
    page = getNextPage(page);
    y = PAGE_HEIGHT - DEFAULT_MARGIN;
  }

  const questionY = drawTextLeftAligned(questionLines, page, {
    font: font,
    size: ITEM_FONT_SIZE,
    lineHeight: ITEM_FONT_SIZE,
    x: x,
    y: y,
  });
  const answerY = drawTextRightAligned(answerLines, page, {
    font: font,
    size: ITEM_FONT_SIZE,
    x: x + ITEM_WIDTH,
    y: y,
  });
  return [page, Math.min(questionY, answerY)];
}

async function drawImageItems(imageItems: ImageItem[], document: PDFDocument, titleFont: PDFFont): Promise<number> {
  let leftRowY = PAGE_HEIGHT - DEFAULT_MARGIN;
  let rightRowY = leftRowY;
  let page: PDFPage = document.addPage();
  for (let i = 0; i < imageItems.length; i += 2) {
    if (i % 6 === 0 && i !== 0) {
      page = document.addPage();
      page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
      leftRowY = PAGE_HEIGHT - DEFAULT_MARGIN;
      rightRowY = leftRowY;
    }
    leftRowY = await drawImageItem(imageItems[i], page, DEFAULT_MARGIN, leftRowY, titleFont);
    if (i + 1 < imageItems.length) {
      rightRowY = await drawImageItem(imageItems[i + 1], page, DEFAULT_MARGIN * 2 + ITEM_WIDTH, rightRowY, titleFont);
    }
  }
  return Math.max(leftRowY, rightRowY);
}

async function drawImageItem(
  imageItem: ImageItem,
  page: PDFPage,
  x: number,
  y: number,
  titleFont: PDFFont
): Promise<number> {
  y = drawTextLeftAligned(splitOnLines(imageItem.title, 45), page, {
    x,
    y,
    font: titleFont,
    size: ITEM_FONT_SIZE,
  });
  const imageBytes = await imageItem.imageBytes;
  const image =
    imageItem.imageType === ImageType.JPG ? await page.doc.embedJpg(imageBytes) : await page.doc.embedPng(imageBytes);
  const scale = Math.max(image.width / ITEM_WIDTH, image.height / IMAGE_MAX_HEIGHT);
  const drawWidth = scale > 1 ? image.width / scale : image.width;
  const drawHeight = scale > 1 ? image.height / scale : image.height;
  page.drawImage(image, {
    x,
    y: y - drawHeight - DEFAULT_MARGIN,
    width: drawWidth,
    height: drawHeight,
  });
  return y - IMAGE_MAX_HEIGHT - 2 * DEFAULT_MARGIN;
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

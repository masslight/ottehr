import { Secrets, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry, getAuth0Token } from '../../../../intake/zambdas/src/shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Questionnaire, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';
import { assertDefined, createOystehrClient, validateJsonBody, validateString } from '../shared/helpers';
import { Color, PageSizes, PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions, StandardFonts } from 'pdf-lib';
import { rgbNormalized } from '../shared/pdf/pdf-utils';
import { getCanonicalQuestionnaire } from 'utils';

interface Input {
  questionnaireResponseId: string;
  secrets: Secrets | null;
}

interface Section {
  title: string;
  items: Item[];
}

interface Item {
  question: string;
  answer: string;
}

enum ImageType {
  JPG,
  PNG,
}

interface ImageItem {
  title: string;
  imageType: ImageType;
  imageBytes: Promise<ArrayBuffer>;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';
const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const DEFAULT_MARGIN = 25;
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

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry(ZAMBDA_NAME, input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponseId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
    const questionnaire = await fetchQuestionnaire(
      assertDefined(questionnaireResponse.questionnaire, 'questionnaireResponse.questionnaire'),
      oystehr
    );
    const [subjectType, subjectId] = (questionnaireResponse.subject?.reference ?? '').split('/');
    if (subjectType !== 'Patient') {
      throw new Error(`Only "Patient" subject is supported but was "${subjectType}"`);
    }
    const patient = await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: subjectId,
    });
    const sections = createSections(questionnaireResponse, questionnaire);
    const imageItems = createImageItems(questionnaireResponse, questionnaire, oystehr);

    const pdfDocument = await PDFDocument.create();
    const page = pdfDocument.addPage();
    page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
    const helveticaFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);

    const y = drawPatientInfo(patient, page, PAGE_HEIGHT - DEFAULT_MARGIN, helveticaBoldFont, helveticaFont);
    drawSections([...sections, ...sections, ...sections, ...sections], page, y, helveticaBoldFont, helveticaFont);
    await drawImageItems(imageItems, pdfDocument, helveticaFont);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from(await pdfDocument.save()).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, input.secrets, captureSentryException);
  }
});

function validateInput(input: ZambdaInput): Input {
  const { questionnaireResponseId } = validateJsonBody(input);
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (zapehrToken == null) {
    zapehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(zapehrToken, secrets);
}

function getItem(
  linkId: string,
  obj?: {
    item?: QuestionnaireResponseItem[] | undefined;
  }
): QuestionnaireResponseItem | undefined {
  return obj?.item?.find((item) => item.linkId === linkId);
}

function drawPatientInfo(
  patient: Patient,
  page: PDFPage,
  y: number,
  patientNameFont: PDFFont,
  pidFont: PDFFont
): number {
  y = drawTextLeftAligned(`${patient.name?.[0].family}, ${patient.name?.[0].given}`, page, {
    x: DEFAULT_MARGIN,
    y,
    font: patientNameFont,
    size: PATIENT_NAME_FONT_SIZE,
  });
  y = drawTextLeftAligned(`PID: ${patient.id}`, page, {
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
  y = drawTextLeftAligned(splitOnLines(section.title, 30), page, {
    x,
    y,
    font: titleFont,
    size: SECTION_TITLE_FONT_SIZE,
  });
  y -= SECTION_TITLE_MARGIN;
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

function drawItem(item: Item, page: PDFPage, x: number, y: number, font: PDFFont): [PDFPage, number] {
  const { question, answer } = item;
  const questionLines = splitOnLines(question, ITEM_MAX_CHARS_PER_LINE);
  const answerLines = splitOnLines(answer, ITEM_MAX_CHARS_PER_LINE);

  const questionHeight = calculateTextHeight(questionLines, { font: font, fontSize: ITEM_FONT_SIZE });
  const answerHeight = calculateTextHeight(answerLines, { font: font, fontSize: ITEM_FONT_SIZE });
  if (y - Math.max(questionHeight, answerHeight) < DEFAULT_MARGIN) {
    const pdfDocument = page.doc;
    const currentPageIndex = getPageIndex(page);
    if (currentPageIndex === pdfDocument.getPageCount() - 1) {
      page = pdfDocument.addPage();
      page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      page = pdfDocument.getPage(currentPageIndex + 1);
    }
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

function splitOnLines(text: string, maxCharsPerLine: number): string {
  const words = text.split(' ');
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

function createSections(questionnaireResponse: QuestionnaireResponse, questionnaire: Questionnaire): Section[] {
  return (questionnaireResponse.item ?? []).flatMap<Section>((sectionItem) => {
    const questionItemSection = getItem(sectionItem.linkId, questionnaire);
    const title = questionItemSection?.text;
    const items = (sectionItem.item ?? []).flatMap<Item>((item) => {
      const question = getItem(item.linkId, questionItemSection)?.text;
      const answer = item.answer?.[0]?.valueString;
      if (question == null || answer == null) {
        return [];
      }
      return [
        {
          question,
          answer,
        },
      ];
    });
    if (title == null || items.length === 0) {
      return [];
    }
    return {
      title,
      items,
    };
  });
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

function createImageItems(
  questionnaireResponse: QuestionnaireResponse,
  questionnaire: Questionnaire,
  oystehr: Oystehr
): ImageItem[] {
  return (questionnaireResponse.item ?? []).flatMap<ImageItem>((sectionItem) => {
    const questionItemSection = getItem(sectionItem.linkId, questionnaire);
    return (sectionItem.item ?? []).flatMap((item) => {
      const title = getItem(item.linkId, questionItemSection)?.text;
      const attachment = item.answer?.[0]?.valueAttachment;
      const url = attachment?.url;
      if (title == null || attachment == null || url == null) {
        return [];
      }
      let imageType: ImageType | undefined = undefined;
      if (attachment.contentType === 'image/jpeg') {
        imageType = ImageType.JPG;
      }
      if (attachment.contentType === 'image/png') {
        imageType = ImageType.PNG;
      }
      if (imageType == null) {
        return [];
      }
      return [
        {
          title,
          imageType,
          imageBytes: downloadImage(url, oystehr),
        },
      ];
    });
  });
}

async function downloadImage(url: string, oystehr: Oystehr): Promise<ArrayBuffer> {
  const pathTokens = url.substring(url.indexOf('/z3/') + 4).split('/');
  return oystehr.z3.downloadFile({
    bucketName: pathTokens[0],
    'objectPath+': pathTokens.slice(1).join('/'),
  });
}

function fetchQuestionnaire(questionnaire: string, oystehr: Oystehr): Promise<Questionnaire> {
  if (questionnaire.includes('|')) {
    const [questionnaireURL, questionnaireVersion] = questionnaire.split('|');
    return getCanonicalQuestionnaire(
      {
        url: questionnaireURL,
        version: questionnaireVersion,
      },
      oystehr
    );
  }
  return oystehr.fhir.get({
    resourceType: 'Questionnaire',
    id: questionnaire,
  });
}

function calculateTextHeight(text: string, options: { font: PDFFont; fontSize: number }): number {
  return options.font.heightAtSize(options.fontSize) * ((text.match(/\n/g) || []).length + 1);
}

function getPageIndex(page: PDFPage): number {
  return page.doc.getPages().indexOf(page);
}

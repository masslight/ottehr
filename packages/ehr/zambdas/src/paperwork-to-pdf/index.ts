import { Secrets, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry, getAuth0Token } from '../../../../intake/zambdas/src/shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';
import { assertDefined, createOystehrClient, validateJsonBody, validateString } from '../shared/helpers';
import { Color, PageSizes, PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions, StandardFonts } from 'pdf-lib';
import { rgbNormalized } from '../shared/pdf/pdf-utils';

interface Input {
  questionnaireResponseId: string;
  secrets: Secrets | null;
}

interface Item {
  question: string;
  answer: string;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';
const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const DEFAULT_MARGIN = 25;
const SECTION_TITLE_FONT_SIZE = 16;
const SECTION_TITLE_MARGIN = 10;
const ITEM_DIVIDER_THICKNESS = 1;
const ITEM_DIVIDER_MARGIN = 8;
const ITEM_DIVIDER_COLOR = rgbNormalized(0xdf, 0xe5, 0xe9);
const ITEM_WIDTH = (PAGE_WIDTH - DEFAULT_MARGIN * 3) / 2;
const ITEM_FONT_SIZE = 12;
const ITEM_MAX_CHARS_PER_LINE = 25;

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry(ZAMBDA_NAME, input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    /*const { questionnaireResponseId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
    const contactInformationPage = getItem('contact-information-page', questionnaireResponse);
    const patientDetailsPage = getItem('patient-details-page', questionnaireResponse);
    const paymentOptionPage = getItem('payment-option-page', questionnaireResponse);
    const responsiblePartyPage = getItem('responsible-party-page', questionnaireResponse);
    const consentFormsPage = getItem('consent-forms-page', questionnaireResponse);*/

    const pdfDocument = await PDFDocument.create();
    const page = pdfDocument.addPage();
    page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
    const helveticaFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
    drawSection(
      'Contact information',
      [
        {
          question: 'Street address',
          answer: 'Old Town Road, 123',
        },
        {
          question: 'Address line 2',
          answer: '-',
        },
        {
          question: 'City, State, ZIP',
          answer: 'New York, NY, 12345',
        },
      ],
      page,
      DEFAULT_MARGIN,
      PAGE_HEIGHT - DEFAULT_MARGIN,
      helveticaBoldFont,
      helveticaFont
    );
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
  obj: {
    item?: QuestionnaireResponseItem[] | undefined;
  }
): QuestionnaireResponseItem | undefined {
  return obj.item?.find((item) => item.linkId === linkId);
}

function drawSection(
  title: string,
  items: Item[],
  page: PDFPage,
  x: number,
  y: number,
  titleFont: PDFFont,
  itemFont: PDFFont
): number {
  const initialY = y;
  y -= drawTextLeftAligned(title, page, {
    x,
    y,
    font: titleFont,
    size: SECTION_TITLE_FONT_SIZE,
  });
  y -= SECTION_TITLE_MARGIN;
  for (const item of items) {
    y -= drawItem(item, page, x, y, itemFont);
    y -= drawLine(
      {
        x,
        y,
        width: ITEM_WIDTH,
        thickness: ITEM_DIVIDER_THICKNESS,
        color: ITEM_DIVIDER_COLOR,
        margin: ITEM_DIVIDER_MARGIN,
      },
      page
    );
  }
  return initialY - y;
}

function drawItem(item: Item, page: PDFPage, x: number, y: number, font: PDFFont): number {
  const { question, answer } = item;
  const questionLines = splitOnLines(question, ITEM_MAX_CHARS_PER_LINE);
  const questionHeight = drawTextLeftAligned(questionLines, page, {
    font: font,
    size: ITEM_FONT_SIZE,
    lineHeight: ITEM_FONT_SIZE,
    x: x,
    y: y,
  });
  const answerLines = splitOnLines(answer, ITEM_MAX_CHARS_PER_LINE);
  const answerHeight = drawTextRightAligned(answerLines, page, {
    font: font,
    size: ITEM_FONT_SIZE,
    x: x + ITEM_WIDTH,
    y: y,
  });
  console.log(questionHeight + ', ' + answerHeight);
  return Math.max(questionHeight, answerHeight);
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
  const y = assertDefined(options.y, 'options.y') - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
  page.drawText(text, {
    ...options,
    y,
  });
  return font.heightAtSize(fontSize) * ((text.match(/\n/g) || []).length + 1);
}

function drawTextRightAligned(text: string, page: PDFPage, options: PDFPageDrawTextOptions): number {
  const lines = text.split('\n');
  const font = assertDefined(options.font, 'options.font');
  const fontSize = assertDefined(options.size, 'options.size');
  const x = assertDefined(options.x, 'options.x');
  let y = assertDefined(options.y, 'options.y') - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
  for (const line of lines) {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      ...options,
      x: x - lineWidth,
      y: y,
    });
    y -= font.heightAtSize(fontSize);
  }
  return font.heightAtSize(fontSize) * lines.length;
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
  return line.margin * 2 + line.thickness;
}

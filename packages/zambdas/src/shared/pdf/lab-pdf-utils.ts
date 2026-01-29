// cSpell:ignore Hyperlegible
import fs from 'node:fs';
import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { DocumentReference, List, ListEntry, Meta } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Color, PDFFont, PDFImage, StandardFonts } from 'pdf-lib';
import {
  addOperation,
  BUCKET_NAMES,
  FOLDERS_CONFIG,
  getSecret,
  LAB_DOC_REF_DETAIL_TAGS,
  LabType,
  Secrets,
  SecretsKeys,
} from 'utils';
import { sendErrors } from '../errors';
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
    textNote: {
      fontSize: STANDARD_FONT_SIZE - 1,
      spacing: 6,
      font: fontRegular,
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

/**
 * Grabs the List resource representing the Labs folder for patient docs. Swallows errors and returns undefined when List is not found.
 * */
export const getLabListResource = async (
  oystehr: Oystehr,
  patientId: string,
  secrets: Secrets | null,
  pdfTitle?: string
): Promise<List | undefined> => {
  console.log('Getting lab list...');
  try {
    const labsFolderConfig = FOLDERS_CONFIG.find((config) => config.title === BUCKET_NAMES.LABS);
    if (!labsFolderConfig) {
      console.error(`Labs folder config cannot be found: ${JSON.stringify(FOLDERS_CONFIG)}`);
      throw new Error('Labs folder config cannot be found');
    }
    const resources = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          {
            name: 'subject',
            value: `Patient/${patientId}`,
          },
          {
            name: 'code',
            value: 'patient-docs-folder',
          },
          {
            name: 'identifier',
            value: labsFolderConfig.title,
          },
        ],
      })
    ).unbundle();
    if (resources?.length !== 1) {
      console.error(`Got none or too many lab Lists`, JSON.stringify(resources?.map((res) => res.id)));
      throw new Error('Unable to determine Labs List. Found none or many');
    }
    const labListResource = resources[0];
    console.log(`Got lab list List/${labListResource.id}`);
    return labListResource;
  } catch (e) {
    console.warn(
      `Ran into problems getting Labs List. Swallowing error.${
        pdfTitle ? ` ${pdfTitle} will not be added to Patient/${patientId} Labs folder.` : ''
      } Error: ${e}`
    );
    console.log('sending error to sentry');
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendErrors(e, ENVIRONMENT);
    return;
  }
};

/**
 * Dedupes DocRefs and adds any new DocRefs to the labListResource. Swallows errors but sends to Sentry
 * @param oystehr
 * @param labListResource
 * @param docRefReferences
 * @param secrets
 */
export const addDocsToLabList = async (
  oystehr: Oystehr,
  labListResource: List,
  docRefReferences: string[],
  secrets: Secrets | null
): Promise<void> => {
  // grab current entries from the list resource, figure out which unique docs need to get added
  const currentDocRefs = new Set(
    labListResource.entry
      ?.map((entry) => {
        if (entry.item.reference?.startsWith('DocumentReference/')) {
          return entry.item.reference;
        }
        return;
      })
      .filter((elm) => elm !== undefined) ?? []
  );

  const uniqueDocRefs = [...new Set(docRefReferences)];
  const docRefReferencesToAdd = uniqueDocRefs.filter((docRef) => !currentDocRefs.has(docRef));
  const now = DateTime.now().setZone('UTC').toISO() ?? '';
  const newIdsAsEntries: ListEntry[] = docRefReferencesToAdd.map((ref) => {
    return {
      date: now,
      item: {
        type: 'DocumentReference',
        reference: ref,
      },
    };
  });

  console.log('These are the new ids as entries', JSON.stringify(newIdsAsEntries));

  // trying to avoid copying all the existing docs in the folder again since that will grow over time
  const patchOperations: Operation[] = currentDocRefs.size
    ? newIdsAsEntries.map((entry) => addOperation('/entry/-', entry))
    : [addOperation('/entry', newIdsAsEntries)];

  console.log(`These are the patch operations`, JSON.stringify(patchOperations));
  try {
    const listPatchResult = await oystehr.fhir.patch<List>({
      resourceType: 'List',
      id: labListResource?.id ?? '',
      operations: patchOperations,
    });

    console.log('patch results: ', JSON.stringify(listPatchResult));
  } catch (e) {
    console.warn(
      `Encountered error while adding docs to the labs list folder: ${JSON.stringify(
        uniqueDocRefs
      )}. Swallowing error, docs will not be added to labs list folder. Error is: `,
      e
    );
    console.log('sending error to sentry');
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendErrors(e, ENVIRONMENT);
  }
};

/**
 * Returns meta attribute for meant to be applied to lab pdf document references,
 * will includes tags for the type (inhouse or external), testName and fillerLab (if applicable)
 * @param testName
 * @param fillerLab
 */
export const makeLabDocRefMeta = (labDetails: {
  type: LabType;
  testName: string;
  fillerLab: string | undefined;
}): Meta => {
  const { type, testName, fillerLab } = labDetails;
  const metaToReturn: Meta = {
    tag: [
      {
        system: LAB_DOC_REF_DETAIL_TAGS.labType.system,
        code: type,
      },
      {
        system: LAB_DOC_REF_DETAIL_TAGS.testName.system,
        code: testName,
      },
    ],
  };

  if (fillerLab) {
    metaToReturn.tag?.push({
      system: LAB_DOC_REF_DETAIL_TAGS.fillerLab.system,
      code: fillerLab,
    });
  }

  return metaToReturn;
};

export const getLabDocRefDescriptionFromMetaTags = (docRef: DocumentReference): string => {
  const testName = docRef.meta?.tag?.find((t) => t.system === LAB_DOC_REF_DETAIL_TAGS.testName.system)?.code;
  const labName = docRef.meta?.tag?.find((t) => t.system === LAB_DOC_REF_DETAIL_TAGS.fillerLab.system)?.code;

  if (!testName && !labName) return 'Lab Result';

  return `${testName}${labName ? ` / ${labName}` : ''}`;
};

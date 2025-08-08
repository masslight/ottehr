import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { StandardFonts } from 'pdf-lib';
import { BUCKET_NAMES, createFilesDocumentReferences, getPresignedURL, LabelConfig, Secrets } from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { convertLabeConfigToPdfClientStyles } from './external-labs-label-pdf';
import { Y_POS_GAP as pdfClientGapSubtraction } from './pdf-consts';
import { createPdfClient, PdfInfo } from './pdf-utils';
import { TextStyle } from './types';

const VISIT_LABEL_PDF_BASE_NAME = 'VisitLabel';

export const VISIT_LABEL_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/visit-label',
  code: 'visit-label',
  display: 'Visit Label',
};

const DATE_FORMAT = 'MM/dd/yyyy';

interface VisitLabelContent {
  patientLastName: string;
  patientFirstName: string;
  patientMiddleName?: string;
  patientId: string;
  patientDateOfBirth: DateTime | undefined;
  patientGender: string;
  visitDate: DateTime | undefined;
}

export interface VisitLabelConfig {
  labelConfig: LabelConfig;
  content: VisitLabelContent;
}

const createVisitLabelPdfBytes = async (data: VisitLabelConfig): Promise<Uint8Array> => {
  const { labelConfig, content } = data;

  const pdfClientStyles = convertLabeConfigToPdfClientStyles(labelConfig);

  const pdfClient = await createPdfClient(pdfClientStyles);
  // the pdf client initializes YPos to some non-zero number and it's causing huge gaps
  pdfClient.setY(pdfClient.getY() + pdfClientGapSubtraction - 15);

  const CourierBold = await pdfClient.embedStandardFont(StandardFonts.CourierBold);
  const Courier = await pdfClient.embedStandardFont(StandardFonts.Courier);

  const baseFontSize = 7;
  const baseSpacing = 2;

  const textStyles: Record<string, TextStyle> = {
    fieldText: {
      fontSize: baseFontSize,
      spacing: baseSpacing,
      font: Courier,
      newLineAfter: false,
    },
    fieldTextBold: {
      fontSize: baseFontSize,
      spacing: baseSpacing,
      font: CourierBold,
      newLineAfter: false,
    },
    fieldHeader: {
      fontSize: baseFontSize,
      font: CourierBold,
      spacing: baseSpacing,
    },
  };

  const NEWLINE_Y_DROP =
    pdfClient.getTextDimensions('Any text used to get height', textStyles.fieldHeader).height + baseSpacing;

  const drawHeaderAndInlineText = (header: string, text: string): void => {
    pdfClient.drawTextSequential(`${header}: `, textStyles.fieldHeader);
    pdfClient.drawTextSequential(text, textStyles.fieldTextBold);
  };

  const getAgeString = (dob: DateTime | undefined): string => {
    if (!dob || dob.toUTC() > DateTime.utc()) return '';

    // get the date diff between now and the dob
    // const ageInMonths = Math.round(DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).as('months'));
    const { months, weeks, days } = DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).toObject();
    if (!months && !weeks && days !== undefined) {
      return `${days} d`;
    }

    if (!months && weeks !== undefined) return `${weeks} wk`;

    if (months !== undefined) {
      if (months <= 24) return `${months} mo`;
      else {
        return `${Math.floor(months / 12)} yr`;
      }
    }

    throw new Error(`Error processing age string for dob ${dob}`);
  };

  /**
   * Label format looks like:
   *
   * PID:
   * patientLast, patientFirst, patientMiddle
   * DOB: mm/dd/yyyy (#years old yo), gender
   * Visit date: mm/dd/yyyy
   */

  const {
    patientId,
    patientFirstName,
    patientMiddleName,
    patientLastName,
    patientDateOfBirth,
    patientGender,
    visitDate,
  } = content;

  drawHeaderAndInlineText('PID', patientId);
  pdfClient.newLine(NEWLINE_Y_DROP);

  pdfClient.drawTextSequential(
    `${patientLastName}, ${patientFirstName}${patientMiddleName ? `, ${patientMiddleName}` : ''}`,
    { ...textStyles.fieldHeader, fontSize: textStyles.fieldHeader.fontSize + 2 }
  );
  pdfClient.newLine(NEWLINE_Y_DROP);

  const patientDOBString = patientDateOfBirth ? patientDateOfBirth.toFormat(DATE_FORMAT) : '';
  const ageString = getAgeString(patientDateOfBirth);
  const renderAgeString = ageString ? `(${ageString})` : '';
  drawHeaderAndInlineText('DOB', `${patientDOBString} ${renderAgeString}, ${patientGender}`);
  pdfClient.newLine(NEWLINE_Y_DROP);

  drawHeaderAndInlineText('Visit date', visitDate ? visitDate.toFormat(DATE_FORMAT) : '');

  return await pdfClient.save();
};

async function createVisitLabelPDFHelper(
  input: VisitLabelConfig,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating external labs label pdf bytes');

  const pdfBytes = await createVisitLabelPdfBytes(input).catch((error) => {
    throw new Error('failed creating visit label pdfBytes: ' + error.message);
  });

  console.log(`Created visit label pdf bytes`);

  const fileName = `${VISIT_LABEL_PDF_BASE_NAME}-${
    input.content.visitDate ? input.content.visitDate.toFormat(DATE_FORMAT) : ''
  }.pdf`;

  console.log(`Creating base file url for file ${fileName}`);

  const baseFileUrl = makeZ3Url({
    secrets,
    fileName,
    bucketName: BUCKET_NAMES.VISIT_NOTES,
    patientID: input.content.patientId,
  });

  console.log('Uploading file to bucket, ', BUCKET_NAMES.VISIT_NOTES);

  try {
    const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
    await uploadObjectToZ3(pdfBytes, presignedUrl);
  } catch (error: any) {
    throw new Error(`failed uploading pdf ${fileName} to z3:  ${JSON.stringify(error.message)}`);
  }

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

export async function createVisitLabelPDF(
  labelConfig: VisitLabelConfig,
  encounterId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<{ docRef: DocumentReference; presignedURL: string }> {
  const pdfInfo = await createVisitLabelPDFHelper(labelConfig, secrets, token);

  console.log(`This is the made pdfInfo`, JSON.stringify(pdfInfo));

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: { coding: [VISIT_LABEL_DOC_REF_DOCTYPE], text: 'Visit label' },
    references: {
      subject: {
        reference: `Patient/${labelConfig.content.patientId}`,
      },
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    searchParams: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    generateUUID: randomUUID,
    listResources: [], // this for whatever reason needs to get added otherwise the function never adds the new docRef to the returned array
  });

  console.log(`These are the docRefs returned for the label: `, JSON.stringify(docRefs));

  if (!docRefs.length) {
    throw new Error('Unable to make docRefs for label');
  }

  const presignedURL = await getPresignedURL(pdfInfo.uploadURL, token);

  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for visit label PDF');
  }

  return { docRef: docRefs[0], presignedURL };
}

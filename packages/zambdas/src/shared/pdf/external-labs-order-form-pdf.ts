import Oystehr from '@oystehr/sdk';
import { min } from 'lodash';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, FHIR_IDENTIFIER_NPI, getFullestAvailableName, ORDER_ITEM_UNKNOWN, Secrets } from 'utils';
import { LABS_DATE_STRING_FORMAT, resourcesForOrderForm } from '../../ehr/submit-lab-order/helpers';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { getLabFileName } from './labs-results-form-pdf';
import { ICON_STYLE, STANDARD_NEW_LINE, SUB_HEADER_FONT_SIZE } from './pdf-consts';
import {
  drawFieldLineBoldHeader,
  getPdfClientForLabsPDFs,
  PdfInfo,
  rgbNormalized,
  SEPARATED_LINE_STYLE as GREY_LINE_STYLE,
} from './pdf-utils';
import { ExternalLabOrderFormData, PdfClient } from './types';

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsOrderFormPDF(
  input: ExternalLabOrderFormData,
  patientID: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsOrderFormPdfBytes(input).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = BUCKET_NAMES.LABS;
  const fileName = `ExternalLabsOrderForm-${
    input.labOrganizationName ? getLabFileName(input.labOrganizationName) + '-' : ''
  }-${DateTime.fromISO(input.dateIncludedInFileName).toFormat('yyyy-MM-dd')}-${input.orderNumber}-${
    input.orderPriority
  }.pdf`;
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, fileName, bucketName, patientID });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

async function createExternalLabsOrderFormPdfBytes(data: ExternalLabOrderFormData): Promise<Uint8Array> {
  console.log('drawing pdf for ', data.orderNumber);

  let pdfClient: PdfClient;
  const { pdfClient: client, callIcon, faxIcon, locationIcon, textStyles } = await getPdfClientForLabsPDFs();
  pdfClient = client;

  const iconStyleWithMargin = { ...ICON_STYLE, margin: { left: 10, right: 10 } };
  const rightColumnXStart = 315;
  const BLACK_LINE_STYLE = { ...GREY_LINE_STYLE, color: rgbNormalized(0, 0, 0) };
  const GREY_LINE_STYLE_NO_TOP_MARGIN = { ...GREY_LINE_STYLE, margin: { top: 0, bottom: 8 } };

  // Draw header
  console.log(
    `Drawing header. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient.drawText(`${data.labOrganizationName}: Order Form`, textStyles.headerRight); // the original was 18 font
  pdfClient.newLine(STANDARD_NEW_LINE);

  // print 'e-req' if submitting electronically
  if (!data.isManualOrder) {
    console.log(
      `Drawing e-Req line. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
    );
    pdfClient.drawText('E-REQ', { ...textStyles.textBoldRight, fontSize: textStyles.headerRight.fontSize - 2 });
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Location Details (left column)
  console.log(
    `Drawing location details left column. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  const yPosAtStartOfLocation = pdfClient.getY();
  let yPosAtEndOfLocation = yPosAtStartOfLocation;
  if (
    data.locationName ||
    data.locationStreetAddress ||
    data.locationCity ||
    data.locationState ||
    data.locationZip ||
    data.locationPhone ||
    data.locationFax
  ) {
    if (data.locationName) {
      pdfClient.drawTextSequential(data.locationName, textStyles.textBold);
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    pdfClient.drawImage(
      locationIcon,
      { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
      textStyles.text
    );
    const xPosAfterImage = pdfClient.getX();
    if (data.locationStreetAddress) {
      pdfClient.drawTextSequential(data.locationStreetAddress.toUpperCase(), textStyles.text, {
        leftBound: xPosAfterImage,
        rightBound: pdfClient.getRightBound(),
      });
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    if (data.locationCity || data.locationState || data.locationZip) {
      pdfClient.drawStartXPosSpecifiedText(
        `${data.locationCity ? data.locationCity + ', ' : ''}${data.locationState ? data.locationState + ' ' : ''}${
          data.locationZip || ''
        }`.toUpperCase(),
        textStyles.text,
        xPosAfterImage
      );
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    // the phone and fax should be on the same line
    if (data.locationPhone) {
      pdfClient.drawImage(
        callIcon,
        { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
        textStyles.text
      );
      pdfClient.drawTextSequential(data.locationPhone, textStyles.text);
    }

    if (data.locationFax) {
      pdfClient.drawImage(faxIcon, iconStyleWithMargin, textStyles.text);
      pdfClient.drawTextSequential(data.locationFax, textStyles.text);
    }

    if (data.locationPhone || data.locationFax) {
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    yPosAtEndOfLocation = pdfClient.getY();
  }

  // Order number, physician info (right column)
  // go back to where the location info started to start the right column of text
  pdfClient.setY(yPosAtStartOfLocation);
  console.log(
    `Drawing order number, physician info right column. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  let currXPos = pdfClient.drawStartXPosSpecifiedText('Order Number: ', textStyles.textBold, rightColumnXStart).endXPos;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  pdfClient.drawStartXPosSpecifiedText(data.orderNumber, textStyles.text, currXPos).endXPos;

  pdfClient.newLine(STANDARD_NEW_LINE);
  console.log(
    `Drawing physician info. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient.drawStartXPosSpecifiedText(data.providerName, textStyles.textBold, rightColumnXStart);
  pdfClient.newLine(STANDARD_NEW_LINE);

  if (data.providerNPI) {
    currXPos = pdfClient.drawStartXPosSpecifiedText('NPI: ', textStyles.textBold, rightColumnXStart).endXPos;
    pdfClient.drawStartXPosSpecifiedText(data.providerNPI, textStyles.text, currXPos);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  currXPos = pdfClient.drawStartXPosSpecifiedText('Client ID: ', textStyles.textBold, rightColumnXStart).endXPos;
  pdfClient.drawStartXPosSpecifiedText(data.accountNumber, textStyles.text, currXPos);

  // figure out which column drew farther down in the y direction, and set the new y to that, then add newline
  pdfClient.setY(min([pdfClient.getY(), yPosAtEndOfLocation])!);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Line before patient info
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Patient info (left column)
  console.log(
    `Drawing patient info left column. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient.drawTextSequential(
    `${data.patientLastName}, ${data.patientFirstName}${data.patientMiddleName ? ' ' + data.patientMiddleName : ''}, `,
    { ...textStyles.header, newLineAfter: false }
  );
  pdfClient.drawTextSequential(`${data.patientSex}, ${data.patientDOB}`, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'ID:', data.patientId);
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawImage(
    locationIcon,
    { ...iconStyleWithMargin, margin: { ...iconStyleWithMargin.margin, left: 0 } },
    textStyles.text
  );
  pdfClient.drawTextSequential(`${data.patientAddress} `, textStyles.text);
  pdfClient.drawImage(callIcon, iconStyleWithMargin, textStyles.text);
  pdfClient.drawTextSequential(data.patientPhone, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Order date and collection date
  console.log(
    `Drawing order and collection date. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Order Date:', data.orderSubmitDate);
  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Insurance/billing Section
  console.log(
    `Drawing insurance. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Bill Class:', data.billClass);
  pdfClient.newLine(STANDARD_NEW_LINE);

  if (data.primaryInsuranceName) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Primary Insurance Name:', data.primaryInsuranceName);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.primaryInsuranceAddress) {
    pdfClient = drawFieldLineBoldHeader(
      pdfClient,
      textStyles,
      'Insurance Address:',
      data.primaryInsuranceAddress.toUpperCase()
    );
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.primaryInsuranceSubNum) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Subscriber Number:', data.primaryInsuranceSubNum);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.insuredName) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Insured Name:', data.insuredName);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (data.insuredAddress) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Address:', data.insuredAddress);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);
  pdfClient.drawTextSequential('Labs', textStyles.header);

  data.testDetails.forEach((detail, idx) => {
    const lastTest = idx + 1 === data.testDetails.length;

    pdfClient.drawTextSequential(detail.testName.toUpperCase(), {
      ...textStyles.textBold,
      fontSize: SUB_HEADER_FONT_SIZE,
    });
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient = drawFieldLineBoldHeader(
      pdfClient,
      textStyles,
      `Assessments: `,
      detail.testAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', ')
    );
    pdfClient.newLine(STANDARD_NEW_LINE);

    // only print this for non-psc orders
    if (!data.isPscOrder) {
      pdfClient = drawFieldLineBoldHeader(
        pdfClient,
        textStyles,
        'Collection Date:',
        detail.mostRecentSampleCollectionDate?.toFormat(LABS_DATE_STRING_FORMAT) ?? ''
      );
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    // AOE Section
    if (detail.aoeAnswers?.length) {
      pdfClient.newLine(STANDARD_NEW_LINE);
      pdfClient.drawTextSequential('AOE Answers', textStyles.textBold);
      console.log(
        `Drawing AOE. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
      );
      pdfClient.newLine(STANDARD_NEW_LINE + 4);
      detail.aoeAnswers.forEach((item) => {
        pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, `${item.question}: `, item.answer.toString());
        pdfClient.newLine(STANDARD_NEW_LINE);
      });
    }

    pdfClient.newLine(STANDARD_NEW_LINE);
    if (!lastTest) pdfClient.drawSeparatedLine(GREY_LINE_STYLE_NO_TOP_MARGIN);
  });

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Signature
  console.log(
    `Drawing signature. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient.drawTextSequential(`Electronically signed by: ${data.providerName}`, textStyles.textBold);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawTextSequential(data.orderSubmitDate, textStyles.textGreyBold);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(BLACK_LINE_STYLE);

  // Generated by Ottehr
  console.log(
    `Drawing ottehr signature. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  pdfClient.drawTextSequential('Order generated by Ottehr', textStyles.textGreyBold);

  return await pdfClient.save();
}

export function getOrderFormDataConfig(
  orderNumber: string,
  resources: resourcesForOrderForm,
  now: DateTime<true>,
  oystehr: Oystehr
): ExternalLabOrderFormData {
  const {
    testDetails,
    accountNumber,
    labOrganization,
    provider,
    patient,
    timezone,
    location,
    insuranceOrganization,
    coverage,
    isManualOrder,
    isPscOrder,
  } = resources;

  // this is the same logic we use in oystehr to determine PV1-20
  const coverageType = coverage?.type?.coding?.[0]?.code; // assumption: we'll use the first code in the list
  const billClass = !coverage || coverageType === 'pay' ? 'Patient Bill (P)' : 'Third-Party Bill (T)';

  const dataConfig: ExternalLabOrderFormData = {
    locationName: location?.name,
    locationStreetAddress: location?.address?.line?.join(','),
    locationCity: location?.address?.city,
    locationState: location?.address?.state,
    locationZip: location?.address?.postalCode,
    locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
    locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    labOrganizationName: labOrganization?.name || ORDER_ITEM_UNKNOWN,
    accountNumber,
    orderNumber: orderNumber || ORDER_ITEM_UNKNOWN,
    providerName: getFullestAvailableName(provider) || ORDER_ITEM_UNKNOWN,
    providerNPI: provider.identifier?.find((id) => id?.system === FHIR_IDENTIFIER_NPI)?.value,
    patientFirstName: patient.name?.[0].given?.[0] || ORDER_ITEM_UNKNOWN,
    patientMiddleName: patient.name?.[0].given?.[1],
    patientLastName: patient.name?.[0].family || ORDER_ITEM_UNKNOWN,
    patientSex: patient.gender || ORDER_ITEM_UNKNOWN,
    patientDOB: patient.birthDate
      ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
      : ORDER_ITEM_UNKNOWN,
    patientId: patient.id || ORDER_ITEM_UNKNOWN,
    patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : ORDER_ITEM_UNKNOWN,
    patientPhone: patient.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_ITEM_UNKNOWN,
    todayDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
    orderSubmitDate: now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
    dateIncludedInFileName: testDetails[0].serviceRequestCreatedDate,
    orderPriority: testDetails[0].testPriority || ORDER_ITEM_UNKNOWN, // used for file name
    billClass,
    primaryInsuranceName: insuranceOrganization?.name,
    primaryInsuranceAddress: insuranceOrganization?.address
      ? oystehr.fhir.formatAddress(insuranceOrganization.address?.[0])
      : undefined,
    primaryInsuranceSubNum: coverage?.subscriberId,
    insuredName: patient?.name ? oystehr.fhir.formatHumanName(patient.name[0]) : undefined,
    insuredAddress: patient?.address ? oystehr.fhir.formatAddress(patient.address?.[0]) : undefined,
    testDetails,
    isManualOrder,
    isPscOrder,
  };

  return dataConfig;
}

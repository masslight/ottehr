import Oystehr from '@oystehr/sdk';
import { Address, Coverage, FhirResource, HumanName, Patient, RelatedPerson } from 'fhir/r4b';
import { min } from 'lodash';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  CoverageOrgRank,
  FHIR_IDENTIFIER_NPI,
  formatPhoneNumberDisplay,
  getFullestAvailableName,
  LAB_CLIENT_BILL_COVERAGE_TYPE_CODING,
  LabPaymentMethod,
  ORDER_ITEM_UNKNOWN,
  PaymentResources,
  Secrets,
} from 'utils';
import { LABS_DATE_STRING_FORMAT, resourcesForOrderForm } from '../../ehr/submit-lab-order/helpers';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { drawFieldLineBoldHeader, getPdfClientForLabsPDFs, LabsPDFTextStyleConfig } from './lab-pdf-utils';
import { getLabFileName } from './labs-results-form-pdf';
import { ICON_STYLE, STANDARD_NEW_LINE, SUB_HEADER_FONT_SIZE } from './pdf-consts';
import { BLACK_LINE_STYLE, PdfInfo, SEPARATED_LINE_STYLE as GREY_LINE_STYLE } from './pdf-utils';
import { ExternalLabOrderFormData, OrderFormInsuranceInfo, PdfClient } from './types';

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
  console.log('Creating external labs order form pdf bytes');
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
  const leftColumnBounds = { leftBound: pdfClient.getLeftBound(), rightBound: rightColumnXStart - 10 };
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
      pdfClient.drawTextSequential(data.locationName, textStyles.textBold, leftColumnBounds);
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
        rightBound: leftColumnBounds.rightBound,
      });
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    if (data.locationCity || data.locationState || data.locationZip) {
      pdfClient.drawTextSequential(
        `${data.locationCity ? data.locationCity + ', ' : ''}${data.locationState ? data.locationState + ' ' : ''}${
          data.locationZip || ''
        }`.toUpperCase(),
        textStyles.text,
        {
          leftBound: xPosAfterImage,
          rightBound: leftColumnBounds.rightBound,
        }
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
      pdfClient.drawTextSequential(formatPhoneNumberDisplay(data.locationPhone), textStyles.text, {
        leftBound: pdfClient.getX(),
        rightBound: leftColumnBounds.rightBound,
      });
    }

    if (data.locationFax) {
      pdfClient.drawImage(faxIcon, iconStyleWithMargin, textStyles.text);
      pdfClient.drawTextSequential(data.locationFax, textStyles.text, {
        leftBound: pdfClient.getX(),
        rightBound: leftColumnBounds.rightBound,
      });
    }

    if (data.locationPhone || data.locationFax) {
      pdfClient.newLine(STANDARD_NEW_LINE);
    }

    yPosAtEndOfLocation = pdfClient.getY();
  }

  // Requisition number (aka order number), physician info (right column)
  // go back to where the location info started to start the right column of text
  pdfClient.setY(yPosAtStartOfLocation);
  console.log(
    `Drawing requisition number, physician info right column. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. Current page index is ${pdfClient.getCurrentPageIndex()} out of ${pdfClient.getTotalPages()} pages.`
  );
  let currXPos = pdfClient.drawStartXPosSpecifiedText('Req #: ', textStyles.textBold, rightColumnXStart).endXPos;
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
    `${data.patientLastName}, ${data.patientFirstName}${data.patientMiddleName ? ' ' + data.patientMiddleName : ''} `,
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
  pdfClient.drawTextSequential(formatPhoneNumberDisplay(data.patientPhone), textStyles.text);
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

  if (data.insuranceDetails) {
    // sort these by rank asc just to be sure
    const sortedDetails = data.insuranceDetails.sort((a, b) => a.insuranceRank - b.insuranceRank);

    for (const insuranceDetail of sortedDetails) {
      pdfClient = drawInsuranceDetail(pdfClient, textStyles, insuranceDetail);
    }
  }

  // Test Details
  console.log('Drawing test deails section');
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
    isManualOrder,
    isPscOrder,
    paymentResources,
  } = resources;

  // this is the same logic we use in oystehr to determine PV1-20
  const getBillClass = (paymentResources: PaymentResources): string => {
    let coverage: Coverage | undefined;
    if (paymentResources.type === LabPaymentMethod.Insurance) {
      coverage = paymentResources.coverageAndOrgs[0].coverage;
    } else {
      // client bill or self pay
      coverage = paymentResources.coverage;
    }

    const coverageType = coverage?.type?.coding?.[0]?.code; // assumption: we'll use the first code in the list
    if (!coverage || coverageType === 'pay') {
      return 'Patient Bill (P)';
    } else if (coverageType === LAB_CLIENT_BILL_COVERAGE_TYPE_CODING.code) {
      return 'Client Bill (C)';
    } else {
      return 'Third-Party Bill (T)';
    }
  };
  const billClass = getBillClass(paymentResources);

  const insuranceDetails =
    paymentResources.type === LabPaymentMethod.Insurance
      ? getInsuranceDetails(paymentResources.coverageAndOrgs, patient, oystehr)
      : undefined;

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
    insuranceDetails,
    testDetails,
    isManualOrder,
    isPscOrder,
  };

  return dataConfig;
}

function getInsuranceDetails(
  insuranceCoveragesAndOrgs: CoverageOrgRank[] | undefined,
  patient: Patient,
  oystehr: Oystehr
): OrderFormInsuranceInfo[] | undefined {
  if (!insuranceCoveragesAndOrgs || !insuranceCoveragesAndOrgs.length) return undefined;

  const insuranceInfo: OrderFormInsuranceInfo[] = [];
  insuranceCoveragesAndOrgs.forEach((covAndOrg) => {
    const { coverage, payorOrg: insuranceOrganization, coverageRank } = covAndOrg;
    const { insuredName, insuredAddress } = getInsuredInfoFromCoverageSubscriber(coverage, patient);
    insuranceInfo.push({
      insuranceName: insuranceOrganization?.name,
      insuranceAddress: insuranceOrganization?.address
        ? oystehr.fhir.formatAddress(insuranceOrganization.address?.[0])
        : undefined,
      insuranceSubNum: coverage?.subscriberId,
      insuredName: insuredName && insuredName.length ? oystehr.fhir.formatHumanName(insuredName[0]) : undefined,
      insuredAddress:
        insuredAddress && insuredAddress.length ? oystehr.fhir.formatAddress(insuredAddress[0]) : undefined,
      insuranceRank: coverageRank,
    });
  });

  return insuranceInfo;
}

function getInsuredInfoFromCoverageSubscriber(
  coverage: Coverage,
  patient: Patient
): {
  insuredName: HumanName[] | undefined;
  insuredAddress: Address[] | undefined;
} {
  const subscriberRef = coverage.subscriber?.reference;
  console.log(`subscriberRef for Coverage/${coverage.id} is: ${subscriberRef}`);

  if (subscriberRef === `Patient/${patient.id}`) {
    console.log(`Coverage reference matched Patient/${patient.id}. Setting insuredName and address to patient info`);
    return {
      insuredName: patient.name,
      insuredAddress: patient.address,
    };
  }

  console.log(
    `Coverage reference did not match Patient/${patient.id}. Checking for contained RelatedPerson subscriber`
  );

  const emptyResponse = { insuredName: undefined, insuredAddress: undefined };
  // for the moment always assume we're going to get the subscriber as a contained resource
  if (!subscriberRef || !subscriberRef.startsWith('#')) return emptyResponse;

  // also going to assume the subscriber is only a RelatedPerson
  const subscriber = (coverage.contained as FhirResource[]).find(
    (cont: FhirResource): cont is RelatedPerson =>
      cont.resourceType === 'RelatedPerson' && cont.id === subscriberRef.replace('#', '')
  );

  console.log(`subscriber resource for Coverage/${coverage.id} is: ${JSON.stringify(subscriber)}`);
  if (!subscriber) return emptyResponse;

  return {
    insuredName: subscriber.name,
    insuredAddress: subscriber.address,
  };
}

function drawInsuranceDetail(
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  insuranceDetail: OrderFormInsuranceInfo
): PdfClient {
  const { insuranceRank, insuredName, insuredAddress, insuranceName, insuranceAddress, insuranceSubNum } =
    insuranceDetail;

  const rankToLabel = (rank: number | undefined): string => {
    switch (rank) {
      case 1:
        return 'Primary';
      case 2:
        return 'Secondary';
      case 3:
        return 'Terciary';
      default:
        return 'Additional';
    }
  };

  if (insuranceName) {
    pdfClient = drawFieldLineBoldHeader(
      pdfClient,
      textStyles,
      `${rankToLabel(insuranceRank)} Insurance Name:`,
      insuranceName
    );
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (insuranceAddress) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Insurance Address:', insuranceAddress.toUpperCase());
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (insuranceSubNum) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Subscriber Number:', insuranceSubNum);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (insuredName) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Insured Name:', insuredName);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }
  if (insuredAddress) {
    pdfClient = drawFieldLineBoldHeader(pdfClient, textStyles, 'Address:', insuredAddress);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  if (insuredName || insuredAddress || insuranceName || insuranceAddress || insuranceSubNum) {
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  return pdfClient;
}

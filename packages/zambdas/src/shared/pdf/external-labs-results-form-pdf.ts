import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { Color, PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { PdfInfo, rgbNormalized } from './pdf-utils';
import { LabResultsData } from './types';
import {
  createFilesDocumentReferences,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  LAB_RESTULT_PDF_BASE_NAME,
  Secrets,
} from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { DateTime } from 'luxon';
import { randomUUID } from 'crypto';
import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  DiagnosticReport,
  DocumentReference,
  List,
  Location,
  Practitioner,
  Provenance,
  Task,
} from 'fhir/r4b';
import { getLabOrderResources } from '../../ehr/shared/labs';

export async function createLabResultPDF(
  oystehr: Oystehr,
  serviceRequestID: string,
  diagnosticReport: DiagnosticReport,
  reviewed: boolean,
  secrets: Secrets | null,
  token: string
): Promise<void> {
  const {
    serviceRequest,
    patient,
    practitioner: provider,
    task: taskPST,
    appointment,
    encounter,
    organization,
    observations,
  } = await getLabOrderResources(oystehr, serviceRequestID);

  const locationID = serviceRequest.locationReference?.[0].reference?.replace('Location/', '');

  if (!appointment.id) {
    throw new Error('appointment id is undefined');
  }

  if (!encounter.id) {
    throw new Error('encounter id is undefined');
  }
  if (!serviceRequest.reasonCode) {
    throw new Error('service request reasonCode is undefined');
  }

  if (!patient.id) {
    throw new Error('patient.id is undefined');
  }

  const provenanceRequestTemp = (
    await oystehr.fhir.search<Provenance | Practitioner>({
      resourceType: 'Provenance',
      params: [
        {
          name: '_id',
          value: taskPST.relevantHistory?.[0].reference?.replace('Provenance/', '') || '',
        },
        {
          name: '_include',
          value: 'Provenance:agent',
        },
      ],
    })
  )?.unbundle();

  const taskProvenanceTemp: Provenance[] | undefined = provenanceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Provenance => resourceTemp.resourceType === 'Provenance'
  );
  const taskPractitionersTemp: Practitioner[] | undefined = provenanceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Practitioner => resourceTemp.resourceType === 'Practitioner'
  );

  if (taskProvenanceTemp.length !== 1) {
    throw new Error('provenance is not found');
  }

  if (taskPractitionersTemp.length !== 1) {
    throw new Error('practitioner is not found');
  }

  const taskProvenancePST = taskProvenanceTemp[0];
  const taskPractitioner = taskPractitionersTemp[0];

  const taskRequestTemp = (
    await oystehr.fhir.search<Task | Provenance>({
      resourceType: 'Task',
      params: [
        {
          name: 'based-on',
          value: `DiagnosticReport/${diagnosticReport.id}`,
        },
        {
          name: 'status',
          value: 'completed',
        },
        {
          name: 'code',
          value: LAB_ORDER_TASK.code.reviewFinalResult,
        },
      ],
    })
  )?.unbundle();

  const taskRequestsRFRT: Task[] | undefined = taskRequestTemp?.filter(
    (resourceTemp): resourceTemp is Task => resourceTemp.resourceType === 'Task'
  );

  const taskRFRT = taskRequestsRFRT?.[0];
  let provenanceRFRT = undefined;

  if (taskRFRT) {
    const provenanceRFRTID = taskRFRT.relevantHistory?.[0].reference?.replace('Provenance/', '');
    if (provenanceRFRTID) {
      provenanceRFRT = await oystehr.fhir.get<Provenance>({
        resourceType: 'Provenance',
        id: provenanceRFRTID,
      });
    }
  }

  let location: Location | undefined;
  if (locationID) {
    location = await oystehr.fhir.get<Location>({
      resourceType: 'Location',
      id: locationID,
    });
  }

  const now = DateTime.now();
  const orderID = serviceRequest.identifier?.find((item) => item.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value;

  const accessionNumber = diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')?.value;
  const orderSubmitDate = DateTime.fromISO(taskProvenancePST.recorded).toFormat('MM/dd/yyyy hh:mm a');
  const orderCreateDate = serviceRequest.authoredOn
    ? DateTime.fromISO(serviceRequest.authoredOn).toFormat('MM/dd/yyyy hh:mm a')
    : undefined;
  const reviewDate = provenanceRFRT
    ? DateTime.fromISO(provenanceRFRT.recorded).toFormat('MM/dd/yyyy hh:mm a')
    : undefined;
  const ORDER_RESULT_ITEM_UNKNOWN = 'UNKNOWN';

  const pdfDetail = await createExternalLabsResultsFormPDF(
    {
      locationName: location?.name,
      locationStreetAddress: location?.address?.line?.join(','),
      locationCity: location?.address?.city,
      locationState: location?.address?.state,
      locationZip: location?.address?.postalCode,
      locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
      labOrganizationName: organization.name || ORDER_RESULT_ITEM_UNKNOWN,
      reqId: orderID || ORDER_RESULT_ITEM_UNKNOWN,
      providerName: provider.name ? oystehr.fhir.formatHumanName(provider.name[0]) : ORDER_RESULT_ITEM_UNKNOWN,
      providerTitle:
        provider.qualification?.map((qualificationTemp) => qualificationTemp.code.text).join(', ') ||
        ORDER_RESULT_ITEM_UNKNOWN,
      providerNPI:
        provider.identifier?.find((id) => id.system === 'http://hl7.org/fhir/sid/us-npi')?.value ||
        ORDER_RESULT_ITEM_UNKNOWN,
      patientFirstName: patient.name?.[0].given?.[0] || ORDER_RESULT_ITEM_UNKNOWN,
      patientMiddleName: patient.name?.[0].given?.[1],
      patientLastName: patient.name?.[0].family || ORDER_RESULT_ITEM_UNKNOWN,
      patientSex: patient.gender || ORDER_RESULT_ITEM_UNKNOWN,
      patientDOB: patient.birthDate
        ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
        : ORDER_RESULT_ITEM_UNKNOWN,
      patientId: patient.id,
      patientAddress: patient.address?.[0] ? oystehr.fhir.formatAddress(patient.address[0]) : ORDER_RESULT_ITEM_UNKNOWN,
      patientPhone:
        patient.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value || ORDER_RESULT_ITEM_UNKNOWN,
      todayDate: now.toFormat('MM/dd/yy hh:mm a'),
      orderSubmitDate: orderSubmitDate,
      orderCreateDate: orderCreateDate || ORDER_RESULT_ITEM_UNKNOWN,
      orderPriority: serviceRequest.priority || ORDER_RESULT_ITEM_UNKNOWN,
      testName:
        serviceRequest.contained
          ?.filter((item): item is ActivityDefinition => item.resourceType === 'ActivityDefinition')
          .map((resource) => resource.title)
          .join(', ') || ORDER_RESULT_ITEM_UNKNOWN,
      orderAssessments: serviceRequest.reasonCode.map((code) => ({
        code: code.coding?.[0].code || ORDER_RESULT_ITEM_UNKNOWN,
        name: code.text || ORDER_RESULT_ITEM_UNKNOWN,
      })),
      accessionNumber: accessionNumber || ORDER_RESULT_ITEM_UNKNOWN,
      // orderReceived: '10/10/2024',
      // specimenReceived: '10/10/2024',
      // reportDate: '10/10/2024',
      // specimenSource: 'Throat',
      // specimenDescription: 'Throat culture',
      specimenValue: undefined,
      specimenReferenceRange: undefined,
      resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || ORDER_RESULT_ITEM_UNKNOWN,
      reviewed,
      reviewingProviderFirst: taskPractitioner.name?.[0].given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      reviewingProviderLast: taskPractitioner.name?.[0].family || ORDER_RESULT_ITEM_UNKNOWN,
      reviewingProviderTitle: ORDER_RESULT_ITEM_UNKNOWN,
      reviewDate: reviewDate,
      results: observations.map((observation) => ({
        resultCode: observation.code.coding?.[0].code || ORDER_RESULT_ITEM_UNKNOWN,
        resultCodeDisplay: observation.code.coding?.[0].display || ORDER_RESULT_ITEM_UNKNOWN,
        resultInterpretation: observation.interpretation?.[0].coding?.[0].code || ORDER_RESULT_ITEM_UNKNOWN,
        resultInterpretationDisplay: observation.interpretation?.[0].coding?.[0].display || ORDER_RESULT_ITEM_UNKNOWN,
        resultValue: `${observation.valueQuantity?.value || ORDER_RESULT_ITEM_UNKNOWN} ${
          observation.valueQuantity?.code || ORDER_RESULT_ITEM_UNKNOWN
        }`,
      })),
      testItemCode:
        diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
        diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
        ORDER_RESULT_ITEM_UNKNOWN,
      performingLabName: organization.name || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabStreetAddress: organization.address?.[0].line?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabCity: organization.address?.[0].city || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabState: organization.address?.[0].state || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabZip: organization.address?.[0].postalCode || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabPhone:
        organization.contact
          ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
          ?.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_RESULT_ITEM_UNKNOWN,
      // abnormalResult: true,
      performingLabDirectorFirstName:
        organization.contact
          ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
          ?.name?.given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabDirectorLastName:
        organization.contact?.find(
          (temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director')
        )?.name?.family || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabDirectorTitle: ORDER_RESULT_ITEM_UNKNOWN,
      // performingLabDirector: organization.contact?.[0].name
      //   ? oystehr.fhir.formatHumanName(organization.contact?.[0].name)
      //   : ORDER_RESULT_ITEM_UNKNOWN,
    },
    patient.id,
    secrets,
    token
  );

  await makeLabPdfDocumentReference({
    oystehr,
    type: 'results',
    pdfInfo: pdfDetail,
    patientID: patient.id,
    encounterID: encounter.id,
    diagnosticReportID: diagnosticReport.id,
    reviewed,
  });
}

async function createExternalLabsResultsFormPdfBytes(data: LabResultsData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage();
  page.setSize(PageSizes.A4[0], PageSizes.A4[1]);
  const { height, width } = page.getSize();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const callIcon = './assets/call.png';
  const faxIcon = './assets/fax.png';

  const locationCityStateZip = `${data.locationCity?.toUpperCase() || ''}${data.locationCity ? ', ' : ''}${
    data.locationState?.toUpperCase() || ''
  }${data.locationState ? ' ' : ''}${data.locationZip?.toUpperCase() || ''}`;

  const styles = {
    image: {
      width: 110,
      height: 28,
    },
    largeHeader: {
      font: helveticaBoldFont,
      fontSize: 18,
    },
    subHeader: {
      font: helveticaBoldFont,
      fontSize: 14,
    },
    regularText: {
      font: helveticaFont,
      fontSize: 12,
    },
    regularTextBold: {
      font: helveticaBoldFont,
      fontSize: 12,
    },
    spacing: {
      image: 12,
      regularText: 2,
      header: 25,
      paragraph: 3,
      block: 60,
    },
    margin: {
      x: 20,
      y: 20,
    },
    colors: {
      lightGrey: rgbNormalized(223, 229, 233),
      purple: rgbNormalized(77, 21, 183),
      red: rgbNormalized(198, 40, 40),
      black: rgbNormalized(0, 0, 0),
    },
  };

  let currYPos = height - styles.margin.y;
  let currXPos = styles.margin.x;
  const regularLineHeight = 14;
  const regularTextWidth = 5;
  const pageTextWidth = width - styles.margin.x * 2;
  const imageWidth = 12;
  const imageHeight = 12;

  const addNewLine = (height?: number, count?: number): void => {
    const heightOfLines = height || regularLineHeight;
    const numberOfLines = count || 1;
    currYPos -= heightOfLines * numberOfLines;
  };

  const drawHeader = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;
    const textWidth = font.widthOfTextAtSize(text, size);
    const xPosition = width - styles.margin.x - textWidth;

    page.drawText(text, {
      font: font,
      size: size,
      x: xPosition,
      y: currYPos,
      color: styles.colors.purple,
    });
  };

  const drawLargeHeader = (text: string): void => {
    const font = styles.largeHeader.font;
    const size = styles.largeHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: currXPos,
      y: currYPos,
      color: styles.colors.purple,
    });
  };
  const drawSubHeaderLeft = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: currXPos,
      y: currYPos,
    });
  };

  const drawSubHeaderRight = (text: string): void => {
    const font = styles.subHeader.font;
    const size = styles.subHeader.fontSize;

    page.drawText(text, {
      font: font,
      size: size,
      x: width - (styles.margin.x + font.widthOfTextAtSize(text, size)),
      y: currYPos,
    });
  };

  const drawFieldLineLeft = (fieldName: string, fieldValue: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const maxWidth = pageTextWidth - font.widthOfTextAtSize(fieldName, size) - regularTextWidth;

    const splitTextIntoLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach((word) => {
        const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(lineWithWord, size) <= maxWidth) {
          currentLine = lineWithWord;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) lines.push(currentLine);
      return lines;
    };

    page.drawText(fieldName, {
      font,
      size,
      x: currXPos,
      y: currYPos,
    });

    const lines = splitTextIntoLines(fieldValue, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, {
        font: styles.regularTextBold.font,
        size: styles.regularTextBold.fontSize,
        x: currXPos + font.widthOfTextAtSize(fieldName, size) + regularTextWidth,
        y: currYPos - index * regularLineHeight,
      });
    });

    currYPos -= regularLineHeight * (lines.length - 1);
  };

  const drawFieldLineRight = (fieldName: string, fieldValue: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const namePosition = pageTextWidth * 0.6;
    const valuePosition = namePosition + (regularTextWidth + font.widthOfTextAtSize(fieldName, size));
    page.drawText(fieldName, {
      font: styles.regularText.font,
      size: styles.regularText.fontSize,
      x: namePosition,
      y: currYPos,
    });
    page.drawText(fieldValue, {
      font: styles.regularTextBold.font,
      size: styles.regularTextBold.fontSize,
      x: valuePosition,
      y: currYPos,
    });
  };

  const drawRegularTextLeft = (text: string, textFont?: PDFFont): void => {
    page.drawText(text, {
      font: textFont || styles.regularText.font,
      size: styles.regularText.fontSize,
      x: currXPos,
      y: currYPos,
    });
  };

  const drawRegularTextRight = (text: string, textFont?: PDFFont): void => {
    textFont = textFont || styles.regularText.font;
    const textWidth = textFont.widthOfTextAtSize(text, styles.regularText.fontSize);
    const xPosition = width - (styles.margin.x + textWidth);

    page.drawText(text, {
      font: textFont,
      size: styles.regularText.fontSize,
      x: xPosition,
      y: currYPos,
    });
  };

  const drawFiveColumnText = (
    columnOneName: string,
    columnTwoName: string,
    columnThreeName: string,
    columnFourName: string,
    columnFiveName: string,
    columnFont?: PDFFont,
    columnFontSize?: number,
    color?: Color
  ): void => {
    const font = columnFont || styles.regularText.font;
    const fontSize = columnFontSize || styles.regularText.fontSize;
    const fontColor = color || styles.colors.black;
    page.drawText(columnOneName, {
      font: font,
      size: fontSize,
      x: currXPos,
      y: currYPos,
      color: styles.colors.black,
    });
    page.drawText(columnTwoName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 10,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnThreeName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 2,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnFourName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 1.5,
      y: currYPos,
      color: fontColor,
    });
    page.drawText(columnFiveName, {
      font: font,
      size: fontSize,
      x: pageTextWidth / 1.1,
      y: currYPos,
      color: fontColor,
    });
  };

  const drawFreeText = (freeText: string): void => {
    const font = styles.regularText.font;
    const size = styles.regularText.fontSize;
    const maxWidth = pageTextWidth - styles.margin.x * 2;

    const splitTextIntoLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach((word) => {
        const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(lineWithWord, size) <= maxWidth) {
          currentLine = lineWithWord;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const lines = splitTextIntoLines(freeText, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, {
        font,
        size,
        x: currXPos + styles.margin.x,
        y: currYPos - index * regularLineHeight,
      });
    });

    currYPos -= regularLineHeight * (lines.length - 1);
  };

  const drawImage = async (imgPath: string): Promise<void> => {
    const imgBytes = fs.readFileSync(imgPath);
    const img = pdfDoc.embedPng(imgBytes);
    currYPos -= 1.5;
    page.drawImage(await img, {
      x: currXPos,
      y: currYPos,
      width: imageWidth,
      height: imageHeight,
    });
    currYPos += 1.5;
  };

  const drawSeparatorLine = (paddingLeft?: number, paddingRight?: number): void => {
    page.drawLine({
      start: { x: paddingLeft || 0, y: currYPos },
      end: { x: paddingRight || width, y: currYPos },
      thickness: 1,
      color: styles.colors.lightGrey,
    });
    currYPos -= regularLineHeight / 2;
  };

  const calculateAge = (dob: string): number => {
    const dobDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const referenceRangeText = (): string => {
    if (data.specimenReferenceRange) {
      return data.specimenReferenceRange;
    } else {
      return '';
    }
  };

  const referenceRangeTitle = (): string => {
    if (data.specimenReferenceRange) {
      return 'Reference Range'.toUpperCase();
    } else {
      return '';
    }
  };

  // --- add all sections to PDF ---
  // ===============================
  // Main header
  addNewLine();
  // name
  if (data.patientMiddleName) {
    drawSubHeaderLeft(`${data.patientLastName}, ${data.patientFirstName}, ${data.patientMiddleName}`);
  } else {
    drawSubHeaderLeft(`${data.patientLastName}, ${data.patientFirstName}`);
  }
  drawSubHeaderRight(`Ottehr${data.locationName || ''}`);
  addNewLine();
  drawRegularTextLeft(`${data.patientDOB}, ${calculateAge(data.patientDOB)} Y, ${data.patientSex}`);
  drawRegularTextRight(locationCityStateZip);
  addNewLine();
  drawRegularTextLeft(`ID: ${data.patientId}`);
  currXPos =
    width -
    styles.margin.x -
    imageWidth * 2 -
    regularTextWidth * 3 -
    styles.regularText.font.widthOfTextAtSize(data?.locationPhone || '', styles.regularText.fontSize) -
    styles.regularText.font.widthOfTextAtSize(data?.locationFax || '', styles.regularText.fontSize);
  if (data?.locationPhone) await drawImage(callIcon);
  currXPos =
    width -
    styles.margin.x -
    imageWidth -
    regularTextWidth * 2 -
    styles.regularText.font.widthOfTextAtSize(data?.locationPhone || '', styles.regularText.fontSize) -
    styles.regularText.font.widthOfTextAtSize(data?.locationFax || '', styles.regularText.fontSize);
  drawRegularTextLeft(data?.locationPhone || '');
  currXPos =
    width -
    styles.margin.x -
    imageWidth -
    regularTextWidth -
    styles.regularText.font.widthOfTextAtSize(data?.locationFax || '', styles.regularText.fontSize);
  if (data?.locationFax) await drawImage(faxIcon);
  currXPos =
    width -
    styles.margin.x -
    styles.regularText.font.widthOfTextAtSize(data?.locationFax || '', styles.regularText.fontSize);
  drawRegularTextLeft(data?.locationFax || '');
  currXPos = styles.margin.x;
  addNewLine();
  drawRegularTextLeft(data.patientPhone);
  addNewLine(undefined, 2);
  drawHeader('FINAL RESULT');
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Order details
  drawFieldLineLeft('Accession ID:', data.accessionNumber);
  drawFieldLineRight('Order Create Date:', data.orderCreateDate);
  addNewLine();
  drawFieldLineLeft('Requesting physician:', data.providerName);
  drawFieldLineRight('Collection Date:', data.todayDate);
  addNewLine();
  drawFieldLineLeft('Ordering physician:', data.providerName);
  drawFieldLineRight('Order Printed:', data.todayDate);
  addNewLine();
  drawFieldLineLeft('Req ID:', data.reqId);
  drawFieldLineRight('Order Submit Date:', data.orderSubmitDate);
  addNewLine();
  drawFieldLineLeft('Order priority:', data.orderPriority.toUpperCase());
  // drawFieldLineRight('Order Received:', data.orderReceived);
  addNewLine();
  // drawFieldLineRight('Specimen Received', data.specimenReceived);
  addNewLine();
  // drawFieldLineRight('Reported:', data.reportDate);
  addNewLine();
  drawSeparatorLine();
  addNewLine();

  // Specimen details block
  // drawFieldLineLeft('Specimen source:', data.specimenSource.toUpperCase());
  // drawFieldLineRight('Specimen description:', data.specimenDescription);
  addNewLine();
  drawFieldLineLeft(
    'Dx:',
    data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', ')
  );
  addNewLine(undefined, 3);
  drawLargeHeader(data.testName.toUpperCase());
  addNewLine(undefined, 2);
  drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  addNewLine();
  drawFiveColumnText('', 'NAME', 'VALUE', referenceRangeTitle(), 'LAB');
  addNewLine();
  drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  addNewLine();
  drawFiveColumnText(
    data.resultPhase,
    data.testName.toUpperCase(),
    data.specimenValue?.toUpperCase() || '',
    referenceRangeText(),
    data.testItemCode,
    styles.regularTextBold.font,
    14,
    styles.colors.red
  );
  addNewLine(undefined, 1);
  for (const labResult of data.results) {
    addNewLine(undefined, 1.5);
    drawSeparatorLine(styles.margin.x, width - styles.margin.x);
    addNewLine();
    drawFreeText(`Code: ${labResult.resultCode} (${labResult.resultCodeDisplay})`);
    addNewLine(undefined, 1.5);
    drawFreeText(`Interpretation: ${labResult.resultInterpretation} (${labResult.resultInterpretationDisplay})`);
    addNewLine(undefined, 1.5);
    drawFreeText(`Value: ${labResult.resultValue}`);
  }
  addNewLine(undefined, 1.5);
  drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  addNewLine();

  // Performing lab details
  drawRegularTextRight(`PERFORMING LAB: ${data.performingLabName}`);
  addNewLine();
  drawRegularTextRight(
    `${data.performingLabState}, ${data.performingLabCity}, ${data.performingLabState} ${data.performingLabZip}`
  );
  addNewLine();
  drawRegularTextRight(
    `${data.performingLabDirectorFirstName} ${data.performingLabDirectorLastName}, ${data.performingLabDirectorTitle}, ${data.performingLabPhone}`
  );
  addNewLine();

  // Reviewed by
  if (data.reviewed) {
    drawSeparatorLine();
    addNewLine();
    drawFieldLineLeft(
      `Reviewed: ${data.reviewDate} by`,
      `${data.reviewingProviderTitle} ${data.reviewingProviderFirst} ${data.reviewingProviderLast}`
    );
  }

  return await pdfDoc.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsResultsFormPDF(
  input: LabResultsData,
  patientID: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsResultsFormPdfBytes(input).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  const fileName = `${LAB_RESTULT_PDF_BASE_NAME}${input.reviewed ? '-reviewed' : '-unreviewed'}.pdf`;
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

export async function makeLabPdfDocumentReference({
  oystehr,
  type,
  pdfInfo,
  patientID,
  encounterID,
  listResources,
  serviceRequestID,
  diagnosticReportID,
  reviewed,
}: {
  oystehr: Oystehr;
  type: 'order' | 'results';
  pdfInfo: PdfInfo;
  patientID: string;
  encounterID: string;
  listResources?: List[] | undefined;
  serviceRequestID?: string;
  diagnosticReportID?: string;
  reviewed?: boolean;
}): Promise<DocumentReference> {
  let docType;
  if (type === 'results') {
    docType = {
      coding: [LAB_RESULT_DOC_REF_CODING_CODE],
      text: 'Lab result document',
    };
  } else if (type === 'order') {
    docType = {
      coding: [LAB_ORDER_DOC_REF_CODING_CODE],
      text: 'Lab order document',
    };
  } else {
    throw new Error('Invalid type of lab document');
  }
  const { docRefs } = await createFilesDocumentReferences({
    files: [
      {
        url: pdfInfo.uploadURL,
        title: pdfInfo.title,
      },
    ],
    type: docType,
    references: {
      subject: {
        reference: `Patient/${patientID}`,
      },
      context: {
        related: [
          {
            reference:
              type === 'order' ? `ServiceRequest/${serviceRequestID}` : `DiagnosticReport/${diagnosticReportID}`,
          },
        ],
        encounter: [{ reference: `Encounter/${encounterID}` }],
      },
    },
    docStatus: !reviewed ? 'preliminary' : 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [{ name: 'encounter', value: `Encounter/${encounterID}` }],
    listResources,
  });
  return docRefs[0];
}

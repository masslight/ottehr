import fs from 'fs';
import { Color, PageSizes } from 'pdf-lib';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { createPdfClient, PdfInfo, rgbNormalized } from './pdf-utils';
import {
  LabResultsData,
  ExternalLabResult,
  InHouseLabResult,
  TextStyle,
  PdfClientStyles,
  LineStyle,
  ImageStyle,
} from './types';
import {
  createFilesDocumentReferences,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  EXTERNAL_LAB_RESULT_PDF_BASE_NAME,
  Secrets,
  LabType,
  IN_HOUSE_LAB_RESULT_PDF_BASE_NAME,
  convertActivityDefinitionToTestItem,
  quantityRangeFormat,
  getTimezone,
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
  Specimen,
  Task,
} from 'fhir/r4b';
import { getLabOrderResources } from '../../ehr/shared/labs';
import { LABS_DATE_STRING_FORMAT } from '../../ehr/submit-lab-order';
import { compareDates } from '../../ehr/get-lab-orders/helpers';

const ORDER_RESULT_ITEM_UNKNOWN = 'UNKNOWN';

function formatResultValue(result: string): string {
  if (result === 'Positive') {
    return 'Detected';
  } else if (result === 'Negative') {
    return 'Not detected';
  }
  return result;
}

export async function createLabResultPDF(
  oystehr: Oystehr,
  labType: LabType,
  serviceRequestID: string,
  diagnosticReport: DiagnosticReport,
  reviewed: boolean | undefined,
  secrets: Secrets | null,
  token: string,
  specimen?: Specimen,
  activityDefinition?: ActivityDefinition
): Promise<void> {
  const {
    serviceRequest,
    patient,
    practitioner: provider,
    task, // for external labs this is the Pre-Submission Task or the PST
    appointment,
    encounter,
    organization,
    observations,
  } = await getLabOrderResources(oystehr, labType, serviceRequestID);

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

  if (!diagnosticReport.id) {
    throw new Error('diagnosticReport id is undefined');
  }

  const provenanceRequestTemp = (
    await oystehr.fhir.search<Provenance | Practitioner>({
      resourceType: 'Provenance',
      params: [
        {
          name: '_id',
          value: task.relevantHistory?.[0].reference?.replace('Provenance/', '') || '',
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

  const taskProvenance = taskProvenanceTemp[0];
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
          value: `${LAB_ORDER_TASK.code.reviewFinalResult},${LAB_ORDER_TASK.code.reviewCorrectedResult}`,
        },
      ],
    })
  )?.unbundle();

  const reviewTasksFinalOrCorrected: Task[] | undefined = taskRequestTemp?.filter(
    (resourceTemp): resourceTemp is Task => resourceTemp.resourceType === 'Task'
  );

  const latestReviewTask = reviewTasksFinalOrCorrected?.sort((a, b) => compareDates(a.authoredOn, b.authoredOn))[0];

  let provenanceReviewTask = undefined;

  if (latestReviewTask) {
    const provenanceReviewTaskId = latestReviewTask.relevantHistory?.[0].reference?.replace('Provenance/', '');
    if (provenanceReviewTaskId) {
      provenanceReviewTask = await oystehr.fhir.get<Provenance>({
        resourceType: 'Provenance',
        id: provenanceReviewTaskId,
      });
    }
  }

  console.log(`>>> in labs-results-form-pdf, this is the latestReviewTask`, JSON.stringify(provenanceReviewTask));

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
  let timezone = undefined;
  if (location) {
    timezone = getTimezone(location);
  }

  const orderSubmitDate = DateTime.fromISO(taskProvenance.recorded).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT);
  const orderCreateDate = serviceRequest.authoredOn
    ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
    : undefined;
  const reviewDate = provenanceReviewTask
    ? DateTime.fromISO(provenanceReviewTask.recorded).toFormat(LABS_DATE_STRING_FORMAT)
    : undefined;

  const resultInterpretationDisplays: string[] = [];
  let externalLabResults: ExternalLabResult[] | undefined = undefined;
  let inHouseLabResults: InHouseLabResult[] | undefined = undefined;
  if (labType === 'external') {
    const resultsTemp: ExternalLabResult[] = [];
    observations
      // Get the observations that are in diagnostic report result
      .filter(
        (observation) =>
          diagnosticReport.result?.some((resultTemp) => resultTemp.reference?.split('/')[1] === observation.id)
      )
      .forEach((observation) => {
        const interpretationDisplay = observation.interpretation?.[0].coding?.[0].display;
        let value = undefined;
        if (observation.valueQuantity) {
          value = `${
            observation.valueQuantity?.value !== undefined ? observation.valueQuantity.value : ORDER_RESULT_ITEM_UNKNOWN
          } ${observation.valueQuantity?.code || ORDER_RESULT_ITEM_UNKNOWN}`;
        } else if (observation.valueString) {
          value = observation.valueString;
        } else if (observation.valueCodeableConcept) {
          value =
            observation.valueCodeableConcept.coding?.map((coding) => coding.display).join(', ') ||
            ORDER_RESULT_ITEM_UNKNOWN;
        }

        const referenceRangeText = observation.referenceRange
          ? observation.referenceRange
              .reduce((acc, refRange) => {
                if (refRange.text) {
                  acc.push(refRange.text);
                }
                return acc;
              }, [] as string[])
              .join('. ')
          : undefined;

        const labResult: ExternalLabResult = {
          resultCode: observation.code.coding?.[0].code || ORDER_RESULT_ITEM_UNKNOWN,
          resultCodeDisplay: observation.code.coding?.[0].display || ORDER_RESULT_ITEM_UNKNOWN,
          resultInterpretation: observation.interpretation?.[0].coding?.[0].code,
          resultInterpretationDisplay: interpretationDisplay,
          resultValue: value || ORDER_RESULT_ITEM_UNKNOWN,
          referenceRangeText,
        };
        resultsTemp.push(labResult);
        if (interpretationDisplay) resultInterpretationDisplays.push(interpretationDisplay);
      });
    externalLabResults = resultsTemp;
  } else if (labType === 'in-house') {
    const resultsTemp: InHouseLabResult[] = [];
    if (!activityDefinition) {
      throw new Error('in-house lab activity definition is undefined');
    }

    const components = convertActivityDefinitionToTestItem(activityDefinition, observations).components;
    components.radioComponents.forEach((item) => {
      resultsTemp.push({
        name: item.componentName,
        type: item.dataType,
        value: formatResultValue(item.result?.entry || ''),
        units: item.unit,
        rangeString: item.valueSet
          .filter((value) => !item.abnormalValues.includes(value))
          .map((value) => formatResultValue(value)),
      });
    });
    components.groupedComponents.forEach((item) => {
      if (item.dataType === 'CodeableConcept') {
        resultsTemp.push({
          name: item.componentName,
          type: item.dataType,
          value: formatResultValue(item.result?.entry || ''),
          units: item.unit,
          rangeString: item.valueSet
            .filter((value) => !item.abnormalValues.includes(value))
            .map((value) => formatResultValue(value)),
        });
      } else if (item.dataType === 'Quantity') {
        resultsTemp.push({
          name: item.componentName,
          type: item.dataType,
          value: item.result?.entry,
          units: item.unit,
          rangeQuantity: item,
        });
      }
    });
    inHouseLabResults = resultsTemp;
  }

  let collectionDate = undefined;

  if (labType === 'external') {
    collectionDate = now.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT);
  } else if (labType === 'in-house') {
    if (!specimen?.collection?.collectedDateTime) {
      throw new Error('in-house lab collection date is not defined');
    }
    collectionDate = DateTime.fromISO(specimen?.collection?.collectedDateTime)
      .setZone(timezone)
      .toFormat(LABS_DATE_STRING_FORMAT);
  }

  const pdfDetail = await createExternalLabsResultsFormPDF(
    {
      locationName: location?.name,
      locationStreetAddress: location?.address?.line?.join(','),
      locationCity: location?.address?.city,
      locationState: location?.address?.state,
      locationZip: location?.address?.postalCode,
      locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
      locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
      labOrganizationName: organization?.name || ORDER_RESULT_ITEM_UNKNOWN,
      reqId: orderID || ORDER_RESULT_ITEM_UNKNOWN,
      serviceRequestID: serviceRequest.id || ORDER_RESULT_ITEM_UNKNOWN,
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
      todayDate: now.setZone().toFormat(LABS_DATE_STRING_FORMAT),
      collectionDate: collectionDate || ORDER_RESULT_ITEM_UNKNOWN,
      orderSubmitDate: orderSubmitDate,
      orderCreateDate: orderCreateDate || ORDER_RESULT_ITEM_UNKNOWN,
      orderPriority: serviceRequest.priority || ORDER_RESULT_ITEM_UNKNOWN,
      testName:
        labType === 'external'
          ? diagnosticReport.code.coding?.[0].display || ORDER_RESULT_ITEM_UNKNOWN
          : activityDefinition?.title || ORDER_RESULT_ITEM_UNKNOWN,
      specimenSource:
        specimen?.collection?.bodySite?.coding?.map((coding) => coding.display).join(', ') || ORDER_RESULT_ITEM_UNKNOWN,
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
      resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || ORDER_RESULT_ITEM_UNKNOWN,
      resultStatus: diagnosticReport.status.toUpperCase(),
      reviewed,
      reviewingProviderFirst: taskPractitioner.name?.[0].given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      reviewingProviderLast: taskPractitioner.name?.[0].family || ORDER_RESULT_ITEM_UNKNOWN,
      reviewingProviderTitle: '', // todo where should this come from ??
      reviewDate: reviewDate,
      resultInterpretations: resultInterpretationDisplays,
      externalLabResults,
      inHouseLabResults,
      testItemCode:
        diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
        diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
        ORDER_RESULT_ITEM_UNKNOWN,
      performingLabName: organization?.name || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabStreetAddress: organization?.address?.[0].line?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabCity: organization?.address?.[0].city || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabState: organization?.address?.[0].state || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabZip: organization?.address?.[0].postalCode || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabPhone:
        organization?.contact
          ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
          ?.telecom?.find((temp) => temp.system === 'phone')?.value || ORDER_RESULT_ITEM_UNKNOWN,
      // abnormalResult: true,
      performingLabDirectorFirstName:
        organization?.contact
          ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
          ?.name?.given?.join(',') || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabDirectorLastName:
        organization?.contact?.find(
          (temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director')
        )?.name?.family || ORDER_RESULT_ITEM_UNKNOWN,
      performingLabDirectorTitle: ORDER_RESULT_ITEM_UNKNOWN,
      // performingLabDirector: organization.contact?.[0].name
      //   ? oystehr.fhir.formatHumanName(organization.contact?.[0].name)
      //   : ORDER_RESULT_ITEM_UNKNOWN,
    },
    patient.id,
    labType,
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

async function createExternalLabsResultsFormPdfBytes(data: LabResultsData, type: LabType): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      },
    },
  };
  const pdfClient = await createPdfClient(pdfClientStyles);

  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const RubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));
  const callIcon = await pdfClient.embedImage(fs.readFileSync('./assets/call.png'));
  const faxIcon = await pdfClient.embedImage(fs.readFileSync('./assets/fax.png'));

  const standardFontSize = 12;
  const standardFontSpacing = 12;
  const standardNewline = 17;

  const textStyles: Record<string, TextStyle> = {
    blockHeader: {
      fontSize: standardFontSize,
      spacing: standardFontSpacing,
      font: RubikFontBold,
      newLineAfter: true,
    },
    header: {
      fontSize: 17,
      spacing: standardFontSpacing,
      font: RubikFontBold,
      color: styles.color.purple,
      newLineAfter: true,
    },
    headerRight: {
      fontSize: 17,
      spacing: standardFontSpacing,
      font: RubikFontBold,
      side: 'right',
      color: styles.color.purple,
    },
    fieldHeader: {
      fontSize: standardFontSize,
      font: RubikFont,
      spacing: 1,
    },
    fieldHeaderRight: {
      fontSize: standardFontSize,
      font: RubikFont,
      spacing: 1,
      side: 'right',
    },
    text: {
      fontSize: standardFontSize,
      spacing: 6,
      font: RubikFont,
    },
    textBold: {
      fontSize: standardFontSize,
      spacing: 6,
      font: RubikFontBold,
    },
    textBoldRight: {
      fontSize: standardFontSize,
      spacing: 6,
      font: RubikFontBold,
      side: 'right',
    },
    textRight: {
      fontSize: standardFontSize,
      spacing: 6,
      font: RubikFont,
      side: 'right',
    },
    fieldText: {
      fontSize: standardFontSize,
      spacing: 6,
      font: RubikFont,
      side: 'right',
      newLineAfter: true,
    },
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

  const referenceRangeTitle = (): string => {
    if (data.specimenReferenceRange) {
      return 'Reference Range'.toUpperCase();
    } else {
      return '';
    }
  };

  const iconStyle: ImageStyle = {
    width: 10,
    height: 10,
    // center: true,
  };

  const drawFieldLine = (fieldName: string, fieldValue: string): void => {
    pdfClient.drawTextSequential(fieldName, textStyles.text);
    pdfClient.drawTextSequential(' ', textStyles.textBold);
    pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
  };

  const drawFieldLineRight = (fieldName: string, fieldValue: string): void => {
    pdfClient.drawStartXPosSpecifiedText(fieldName, textStyles.text, 285);
    pdfClient.drawTextSequential(' ', textStyles.textBold);
    pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
  };

  const drawFiveColumnText = (
    columnOneName: string,
    columnTwoName: string,
    columnThreeName: string,
    columnFourName: string,
    columnFiveName: string,
    type: 'external' | 'in-house',
    columnFont?: TextStyle,
    columnFontSize?: number,
    color?: Color
  ): void => {
    const font = columnFont || textStyles.text;
    const fontSize = columnFontSize || standardFontSize;
    const fontStyleTemp = { ...font, fontSize: fontSize, color: color };
    pdfClient.drawStartXPosSpecifiedText(columnOneName, fontStyleTemp, 0);
    pdfClient.drawStartXPosSpecifiedText(columnTwoName, fontStyleTemp, type === 'external' ? 70 : 100);
    pdfClient.drawStartXPosSpecifiedText(columnThreeName, fontStyleTemp, type === 'external' ? 340 : 230);
    pdfClient.drawStartXPosSpecifiedText(columnFourName, fontStyleTemp, 350);
    pdfClient.drawStartXPosSpecifiedText(columnFiveName, fontStyleTemp, type === 'external' ? 490 : 410);
  };

  const separatedLineStyle: LineStyle = {
    thickness: 1,
    color: rgbNormalized(227, 230, 239),
    margin: {
      top: 8,
      bottom: 8,
    },
  };

  // drawFieldLine('Patient Name:', 'test');
  if (data.patientMiddleName) {
    pdfClient.drawText(
      `${data.patientLastName}, ${data.patientFirstName}, ${data.patientMiddleName}`,
      textStyles.textBold
    );
  } else {
    pdfClient.drawText(`${data.patientLastName}, ${data.patientFirstName}`, textStyles.textBold);
  }

  pdfClient.drawText(`Ottehr${data.locationName || ''}`, textStyles.textBoldRight);
  pdfClient.newLine(standardNewline);

  const locationCityStateZip = `${data.locationCity?.toUpperCase() || ''}${data.locationCity ? ', ' : ''}${
    data.locationState?.toUpperCase() || ''
  }${data.locationState ? ' ' : ''}${data.locationZip?.toUpperCase() || ''}`;

  pdfClient.drawText(`${data.patientDOB}, ${calculateAge(data.patientDOB)} Y, ${data.patientSex}`, textStyles.text);
  pdfClient.drawText(locationCityStateZip, textStyles.textRight);

  pdfClient.newLine(standardNewline);

  pdfClient.drawText(`ID: ${data.patientId}`, textStyles.text);

  let margin =
    pdfClient.getRightBound() -
    pdfClient.getLeftBound() -
    iconStyle.width -
    pdfClient.getTextDimensions(` ${data.locationPhone}`, textStyles.text).width -
    5;

  if (data.locationFax) {
    margin -= iconStyle.width + pdfClient.getTextDimensions(` ${data.locationFax}`, textStyles.text).width + 10;
  }

  let iconStyleTemp = { ...iconStyle, margin: { left: margin } };
  if (data.locationPhone) {
    pdfClient.drawImage(callIcon, iconStyleTemp, textStyles.text);
    pdfClient.drawTextSequential(` ${data.locationPhone}`, textStyles.text);
  }

  if (data.locationFax) {
    if (data.locationPhone) {
      margin = 10;
    } else {
      margin =
        pdfClient.getRightBound() -
        pdfClient.getLeftBound() -
        iconStyle.width -
        pdfClient.getTextDimensions(` ${data.locationFax}`, textStyles.text).width -
        5;
    }

    iconStyleTemp = { ...iconStyleTemp, margin: { left: margin } };
    pdfClient.drawImage(faxIcon, iconStyleTemp, textStyles.text);
    pdfClient.drawTextSequential(` ${data.locationFax}`, textStyles.text);
  }

  pdfClient.newLine(standardNewline);

  pdfClient.drawText(data.patientPhone, textStyles.text);
  pdfClient.newLine(standardNewline);
  pdfClient.drawText(`${data.resultStatus} RESULT`, textStyles.headerRight);
  pdfClient.newLine(standardNewline);
  pdfClient.drawSeparatedLine(separatedLineStyle);
  // pdfClient.newLine(5);

  // Order details
  if (type === 'external') {
    drawFieldLine('Accession ID:', data.accessionNumber);
    drawFieldLineRight('Order Create Date:', data.orderCreateDate);
    pdfClient.newLine(standardNewline);
    drawFieldLine('Requesting physician:', data.providerName);
    drawFieldLineRight('Collection Date:', data.collectionDate);
    pdfClient.newLine(standardNewline);
    drawFieldLine('Ordering physician:', data.providerName);
    drawFieldLineRight('Order Printed:', data.todayDate);
    pdfClient.newLine(standardNewline);
    drawFieldLine('Req ID:', data.reqId);
    drawFieldLineRight('Order Submit Date:', data.orderSubmitDate);
    pdfClient.newLine(standardNewline);
    drawFieldLine('Order Priority:', data.orderPriority.toUpperCase());
    // drawFieldLineRight('Order Received:', data.orderReceived);
    pdfClient.newLine(standardFontSize);
    // drawFieldLineRight('Specimen Received', data.specimenReceived);
    pdfClient.newLine(standardFontSize);
    // drawFieldLineRight('Reported:', data.reportDate);
  } else if (type === 'in-house') {
    drawFieldLine('Order ID:', data.serviceRequestID);
    pdfClient.newLine(standardFontSize);
    drawFieldLine('Ordering physician:', data.providerName);
    drawFieldLineRight('Order date:', data.orderCreateDate);
    pdfClient.newLine(standardFontSize);
    drawFieldLineRight('Collection date:', data.collectionDate);
    pdfClient.newLine(standardFontSize);
    pdfClient.drawText('IQC Valid', textStyles.textBold);
    drawFieldLineRight('Final results:', data.orderSubmitDate);
    pdfClient.newLine(standardFontSize);
    // addNewLine();
    // addNewLine();
    // drawFieldLineRight('Order Received:', data.orderReceived);
    // addNewLine();
    // drawFieldLineRight('Specimen Received', data.specimenReceived);
    // addNewLine();
    // drawFieldLineRight('Reported:', data.reportDate);
  }
  pdfClient.drawSeparatedLine(separatedLineStyle);
  // addNewLine();
  // drawSeparatorLine();
  // addNewLine();
  drawFieldLine('Dx:', data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', '));
  pdfClient.newLine(30);
  pdfClient.drawText(data.testName.toUpperCase(), textStyles.header);
  if (type === 'in-house') {
    drawFieldLine('Specimen source:', data.specimenSource);
    pdfClient.newLine(standardFontSize);
  }

  pdfClient.newLine(standardNewline);
  pdfClient.drawSeparatedLine(separatedLineStyle);

  if (type === 'external') {
    if (!data.externalLabResults) {
      throw new Error('external lab results is undefined');
    }
    drawFiveColumnText('', 'NAME', 'VALUE', referenceRangeTitle(), 'LAB', type);
    pdfClient.newLine(standardNewline);
    pdfClient.drawSeparatedLine(separatedLineStyle);
    pdfClient.newLine(standardNewline);
    drawFiveColumnText(
      data.resultPhase,
      data.testName.toUpperCase(),
      getResultValueToDiplay(data.resultInterpretations),
      '',
      data.testItemCode,
      type,
      textStyles.text,
      12,
      getResultRowDisplayColor(data.resultInterpretations)
    );
    pdfClient.newLine(standardNewline);
    for (const labResult of data.externalLabResults) {
      pdfClient.newLine(14);
      pdfClient.drawSeparatedLine(separatedLineStyle);
      pdfClient.newLine(5);
      pdfClient.drawText(`Code: ${labResult.resultCode} (${labResult.resultCodeDisplay})`, textStyles.text);
      if (labResult.resultInterpretation && labResult.resultInterpretationDisplay) {
        pdfClient.newLine(standardNewline);
        const fontStyleTemp = {
          ...textStyles.text,
          color: getResultRowDisplayColor([labResult.resultInterpretationDisplay]),
        };
        pdfClient.drawText(
          `Interpretation: ${labResult.resultInterpretation} (${labResult.resultInterpretationDisplay})`,
          fontStyleTemp
        );
      }
      pdfClient.newLine(standardNewline);
      pdfClient.drawText(`Value: ${labResult.resultValue}`, textStyles.text);

      if (labResult.referenceRangeText) {
        pdfClient.newLine(standardNewline);
        pdfClient.drawText(`Reference range: ${labResult.referenceRangeText}`, textStyles.text);
      }
    }
  } else if (type === 'in-house') {
    if (!data.inHouseLabResults) {
      throw new Error('in-house lab results is undefined');
    }
    drawFiveColumnText('NAME', '', 'VALUE', 'UNITS', 'REFERENCE RANGE', type);
    pdfClient.newLine(standardNewline);
    pdfClient.drawSeparatedLine(separatedLineStyle);
    for (const labResult of data.inHouseLabResults) {
      let resultRange = undefined;
      if (labResult.rangeString) {
        resultRange = labResult.rangeString.join(', ');
      } else if (labResult.rangeQuantity) {
        resultRange = quantityRangeFormat(labResult.rangeQuantity);
      } else {
        resultRange = ORDER_RESULT_ITEM_UNKNOWN;
      }
      drawFiveColumnText(
        labResult.name,
        '',
        labResult.value || '',
        labResult.units || '',
        resultRange,
        type,
        textStyles.text,
        undefined,
        getInHouseResultRowDisplayColor(labResult)
      );
      pdfClient.newLine(standardNewline);
    }
  }
  pdfClient.newLine(standardNewline);
  pdfClient.drawSeparatedLine(separatedLineStyle);
  pdfClient.newLine(standardNewline);

  if (type === 'external') {
    // Performing lab details
    pdfClient.drawText(`PERFORMING LAB: ${data.performingLabName}`, textStyles.textRight);
    pdfClient.newLine(standardNewline);
    pdfClient.drawText(
      `${data.performingLabState}, ${data.performingLabCity}, ${data.performingLabState} ${data.performingLabZip}`,
      textStyles.textRight
    );
    pdfClient.newLine(standardNewline);
    pdfClient.drawText(
      `${data.performingLabDirectorFirstName} ${data.performingLabDirectorLastName}, ${data.performingLabDirectorTitle}, ${data.performingLabPhone}`,
      textStyles.textRight
    );
    pdfClient.newLine(standardNewline);

    // Reviewed by
    if (data.reviewed) {
      pdfClient.drawSeparatedLine(separatedLineStyle);
      pdfClient.newLine(standardNewline);
      drawFieldLine(
        `Reviewed: ${data.reviewDate} by`,
        `${data.reviewingProviderTitle} ${data.reviewingProviderFirst} ${data.reviewingProviderLast}`
      );
    }
  }
  return await pdfClient.save();

  // // Specimen details block
  // // drawFieldLineLeft('Specimen source:', data.specimenSource.toUpperCase());
  // // drawFieldLineRight('Specimen description:', data.specimenDescription);
  // addNewLine();
  // addNewLine();
  // addNewLine(undefined, 2);
  // drawSeparatorLine(styles.margin.x, width - styles.margin.x);
  // addNewLine();

  // return await pdfDoc.save();
}

function getResultValueToDiplay(resultInterpretations: string[]): string {
  const resultInterpretationsLen = resultInterpretations?.length;
  if (resultInterpretationsLen === 0) {
    return '';
  }
  if (resultInterpretationsLen === 1) {
    return resultInterpretations[0].toUpperCase();
  } else {
    return 'See below for details';
  }
}

function getResultRowDisplayColor(resultInterpretations: string[]): Color {
  if (resultInterpretations.every((interpretation) => interpretation.toUpperCase() === 'NORMAL')) {
    // return colors.black;
    return styles.color.black;
  } else {
    return styles.color.red;
  }
}

const styles = {
  color: {
    red: rgbNormalized(255, 0, 0),
    purple: rgbNormalized(77, 21, 183),
    black: rgbNormalized(0, 0, 0),
  },
};

function getInHouseResultRowDisplayColor(labResult: InHouseLabResult): Color {
  if (labResult.value && labResult.rangeString?.includes(labResult.value)) {
    return styles.color.black;
  } else if (labResult.type === 'Quantity') {
    if (labResult.value && labResult.rangeQuantity) {
      const value = parseFloat(labResult.value);
      const { low, high } = labResult.rangeQuantity.normalRange;
      if (value >= low && value <= high) {
        return styles.color.black;
      }
    }
    return styles.color.red;
  }
  return styles.color.red;
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createExternalLabsResultsFormPDF(
  input: LabResultsData,
  patientID: string,
  type: LabType,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createExternalLabsResultsFormPdfBytes(input, type).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  let fileName = undefined;
  if (type === 'external') {
    fileName = `${EXTERNAL_LAB_RESULT_PDF_BASE_NAME}-${input.resultStatus}${
      input.resultStatus === 'preliminary' ? '' : input.reviewed ? '-reviewed' : '-unreviewed'
    }.pdf`;
  } else if (type === 'in-house') {
    fileName = `${IN_HOUSE_LAB_RESULT_PDF_BASE_NAME}.pdf`;
  } else {
    throw new Error(`lab type is unexpected ${type}`);
  }
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
  // this function is also called for creating order pdfs which will not have a DR
  const searchParams = diagnosticReportID ? [{ name: 'related', value: `DiagnosticReport/${diagnosticReportID}` }] : [];
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
    searchParams,
    listResources,
  });
  return docRefs[0];
}

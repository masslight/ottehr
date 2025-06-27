import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  ActivityDefinition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  List,
  Location,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Provenance,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { Color } from 'pdf-lib';
import {
  compareDates,
  convertActivityDefinitionToTestItem,
  createFilesDocumentReferences,
  EXTERNAL_LAB_RESULT_PDF_BASE_NAME,
  getFullestAvailableName,
  getTimezone,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_RESULT_PDF_BASE_NAME,
  IN_HOUSE_LAB_TASK,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  LabType,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  quantityRangeFormat,
  Secrets,
  TestItemComponent,
} from 'utils';
import { fetchResultResourcesForRepeatServiceRequest } from '../../ehr/shared/inhouse-labs';
import { getExternalLabOrderResources } from '../../ehr/shared/labs';
import { LABS_DATE_STRING_FORMAT } from '../../ehr/submit-lab-order';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { ICON_STYLE, PDF_CLIENT_STYLES, STANDARD_FONT_SIZE, STANDARD_NEW_LINE } from './pdf-consts';
import {
  calculateAge,
  createPdfClient,
  drawFieldLine,
  drawFieldLineRight,
  drawFourColumnText,
  getTextStylesForLabsPDF,
  LAB_PDF_STYLES,
  LabsPDFTextStyleConfig,
  PdfInfo,
  SEPARATED_LINE_STYLE,
} from './pdf-utils';
import {
  ExternalLabResult,
  ExternalLabResultsData,
  InHouseLabResult,
  InHouseLabResultConfig,
  InHouseLabResultsData,
  LabResultsData,
  PdfClient,
  ResultDataConfig,
} from './types';

interface CommonDataConfigResources {
  location: Location | undefined;
  timezone: string | undefined;
  serviceRequest: ServiceRequest;
  patient: Patient;
  diagnosticReport: DiagnosticReport;
  providerName: string | undefined;
  testName: string | undefined;
}

type LabTypeSpecificResources =
  | {
      type: LabType.external;
      specificResources: {
        externalLabResults: ExternalLabResult[];
        organization: Organization | undefined;
        collectionDate: string;
        orderSubmitDate: string;
        reviewed: boolean;
        reviewingProvider: Practitioner | undefined;
        reviewDate: string | undefined;
        resultsRecievedDate: string;
        resultInterpretations: string[];
        performingLabDirectorFullName?: string;
        performingLabAddress?: string;
      };
    }
  | { type: LabType.inHouse; specificResources: { inHouseLabResults: InHouseLabResultConfig[] } };

const getResultDataConfig = (
  commonResourceConfig: CommonDataConfigResources,
  specificResourceConfig: LabTypeSpecificResources
): ResultDataConfig => {
  console.log('configuring data to create pdf');
  let config: ResultDataConfig | undefined;
  const now = DateTime.now();

  const { location, timezone, serviceRequest, patient, diagnosticReport, providerName, testName } =
    commonResourceConfig;
  const { type, specificResources } = specificResourceConfig;

  if (!serviceRequest.reasonCode) throw new Error('service request reasonCode is undefined');
  const orderCreateDate = serviceRequest.authoredOn
    ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
    : undefined;

  const baseData: LabResultsData = {
    locationName: location?.name,
    locationStreetAddress: location?.address?.line?.join(','),
    locationCity: location?.address?.city,
    locationState: location?.address?.state,
    locationZip: location?.address?.postalCode,
    locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
    locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    serviceRequestID: serviceRequest.id || '',
    providerName: providerName || '',
    patientFirstName: patient.name?.[0].given?.[0] || '',
    patientMiddleName: patient.name?.[0].given?.[1],
    patientLastName: patient.name?.[0].family || '',
    patientSex: patient.gender || '',
    patientDOB: patient.birthDate ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy') : '',
    patientId: patient.id || '',
    patientPhone: patient.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value || '',
    todayDate: now.setZone().toFormat(LABS_DATE_STRING_FORMAT),
    orderCreateDate: orderCreateDate || '',
    orderPriority: serviceRequest.priority || '',
    testName: testName || '',
    orderAssessments: serviceRequest.reasonCode.map((code) => ({
      code: code.coding?.[0].code || '',
      name: code.text || '',
    })),
    resultStatus: diagnosticReport.status.toUpperCase(),
  };

  if (type === LabType.inHouse) {
    const { inHouseLabResults } = specificResources;
    const inhouseData: Omit<InHouseLabResultsData, keyof LabResultsData> = {
      inHouseLabResults,
    };
    const data: InHouseLabResultsData = { ...baseData, ...inhouseData };
    config = { type: LabType.inHouse, data };
  }

  if (type === LabType.external) {
    const {
      externalLabResults,
      organization,
      collectionDate,
      orderSubmitDate,
      reviewed,
      reviewingProvider,
      reviewDate,
      resultsRecievedDate,
      resultInterpretations,
      performingLabAddress,
      performingLabDirectorFullName,
    } = specificResources;
    const externalLabData: Omit<ExternalLabResultsData, keyof LabResultsData> = {
      orderNumber:
        serviceRequest.identifier?.find((item) => item.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value || '',
      accessionNumber: diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')?.value || '',
      collectionDate,
      orderSubmitDate,
      resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || '',
      reviewed,
      reviewingProvider,
      reviewDate,
      resultInterpretations,
      externalLabResults,
      testItemCode:
        diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
        diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
        '',
      performingLabName: organization?.name || '',
      performingLabAddress,
      performingLabPhone: organization?.contact
        ?.find((temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director'))
        ?.telecom?.find((temp) => temp.system === 'phone')?.value,
      // abnormalResult: true,
      performingLabDirectorFullName,
      resultsRecievedDate,
    };
    const data: ExternalLabResultsData = { ...baseData, ...externalLabData };
    config = { type: LabType.external, data };
  }

  if (!config)
    throw new Error(
      `no config could be formed for this lab result, type: ${type}, serviceRequest Id: ${serviceRequest.id} `
    );

  return config;
};

const getTaskCompletedByAndWhen = async (
  oystehr: Oystehr,
  task: Task,
  timezone: string | undefined
): Promise<{
  reviewingProvider: Practitioner;
  reviewDate: string;
}> => {
  console.log('getting provenance for task', task.id);
  console.log('task relevant history', task.relevantHistory);
  const provenanceId = task.relevantHistory?.[0].reference?.replace('Provenance/', '');
  console.log('provenance id', provenanceId);
  const provenanceRequestTemp = (
    await oystehr.fhir.search<Provenance | Practitioner>({
      resourceType: 'Provenance',
      params: [
        {
          name: '_id',
          value: provenanceId || '',
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

  if (taskProvenanceTemp.length !== 1) throw new Error('provenance is not found');
  if (taskPractitionersTemp.length !== 1) throw new Error('practitioner is not found');

  const taskProvenance = taskProvenanceTemp[0];
  const taskPractitioner = taskPractitionersTemp[0];

  const reviewDate = DateTime.fromISO(taskProvenance.recorded).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT);

  return { reviewingProvider: taskPractitioner, reviewDate };
};

export async function createExternalLabResultPDF(
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
    task: pstTask,
    appointment,
    encounter,
    schedule,
    organization,
    observations,
    specimens,
  } = await getExternalLabOrderResources(oystehr, serviceRequestID);

  const locationID = serviceRequest.locationReference?.[0].reference?.replace('Location/', '');

  let location: Location | undefined;
  if (locationID) {
    location = await oystehr.fhir.get<Location>({
      resourceType: 'Location',
      id: locationID,
    });
  }
  let timezone;
  if (schedule) {
    timezone = getTimezone(schedule);
  }

  if (!appointment.id) throw new Error('appointment id is undefined');
  if (!encounter.id) throw new Error('encounter id is undefined');
  if (!patient.id) throw new Error('patient.id is undefined');
  if (!diagnosticReport.id) throw new Error('diagnosticReport id is undefined');

  const { reviewDate: orderSubmitDate } = await getTaskCompletedByAndWhen(oystehr, pstTask, timezone);

  const taskSearchForFinalOrCorrected = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'based-on',
          value: `DiagnosticReport/${diagnosticReport.id}`,
        },
        {
          name: 'status',
          value: 'completed,ready',
        },
        {
          name: 'code',
          value: `${LAB_ORDER_TASK.code.reviewFinalResult},${LAB_ORDER_TASK.code.reviewCorrectedResult}`,
        },
      ],
    })
  )?.unbundle();

  const { completedFinalOrCorrected, readyFinalOrCorrected } = taskSearchForFinalOrCorrected.reduce(
    (acc: { completedFinalOrCorrected: Task[]; readyFinalOrCorrected: Task[] }, task) => {
      if (task.status === 'completed') acc.completedFinalOrCorrected.push(task);
      if (task.status === 'ready') acc.readyFinalOrCorrected.push(task);
      return acc;
    },
    { completedFinalOrCorrected: [], readyFinalOrCorrected: [] }
  );

  const sortedCompletedFinalOrCorrected = completedFinalOrCorrected?.sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const latestReviewTask = sortedCompletedFinalOrCorrected[0];
  console.log(`>>> in labs-results-form-pdf, this is the latestReviewTask`, latestReviewTask?.id);

  let reviewDate = '',
    reviewingProvider = undefined,
    resultsRecievedDate = '';

  if (latestReviewTask) {
    resultsRecievedDate = latestReviewTask?.authoredOn
      ? DateTime.fromISO(latestReviewTask.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
      : '';
    if (latestReviewTask.status === 'completed') {
      ({ reviewingProvider, reviewDate } = await getTaskCompletedByAndWhen(oystehr, latestReviewTask, timezone));
    }
  }
  if (!resultsRecievedDate && !latestReviewTask) {
    console.log('no completed final or corrected tasks, checking ready tasks to parse a results recieved date');
    const sortedReadyFinalOrCorrected = readyFinalOrCorrected?.sort((a, b) => compareDates(a.authoredOn, b.authoredOn));
    const readyReviewTask = sortedReadyFinalOrCorrected[0];
    if (readyReviewTask && readyReviewTask?.authoredOn) {
      console.log('readyReviewTask: ', readyReviewTask.id);
      resultsRecievedDate = DateTime.fromISO(readyReviewTask.authoredOn)
        .setZone(timezone)
        .toFormat(LABS_DATE_STRING_FORMAT);
    }
  }

  const resultInterpretationDisplays: string[] = [];
  const externalLabResults: ExternalLabResult[] = [];
  observations
    .filter(
      (observation) =>
        diagnosticReport.result?.some((resultTemp) => resultTemp.reference?.split('/')[1] === observation.id)
    )
    .forEach((observation) => {
      const interpretationDisplay = observation.interpretation?.[0].coding?.[0].display;
      let value = undefined;
      if (observation.valueQuantity) {
        value = `${observation.valueQuantity?.value !== undefined ? observation.valueQuantity.value : ''} ${
          observation.valueQuantity?.code || ''
        }`;
      } else if (observation.valueString) {
        value = observation.valueString;
      } else if (observation.valueCodeableConcept) {
        value = observation.valueCodeableConcept.coding?.map((coding) => coding.display).join(', ') || '';
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
        resultCode: observation.code.coding?.[0].code || '',
        resultCodeDisplay: observation.code.coding?.[0].display || '',
        resultInterpretation: observation.interpretation?.[0].coding?.[0].code,
        resultInterpretationDisplay: interpretationDisplay,
        resultValue: value || '',
        referenceRangeText,
        resultNotes: observation.note?.map((note) => note.text),
      };
      externalLabResults.push(labResult);
      if (interpretationDisplay) resultInterpretationDisplays.push(interpretationDisplay);
    });

  const sortedSpecimens = specimens?.sort((a, b) =>
    compareDates(a.collection?.collectedDateTime, b.collection?.collectedDateTime)
  );
  const specimenCollectionDate = sortedSpecimens?.[0]?.collection?.collectedDateTime;
  const collectionDate = specimenCollectionDate
    ? DateTime.fromISO(specimenCollectionDate).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
    : DateTime.now().setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT);

  const externalSpecificResources: LabTypeSpecificResources = {
    type: LabType.external,
    specificResources: {
      externalLabResults,
      organization,
      collectionDate,
      orderSubmitDate,
      reviewed,
      reviewingProvider,
      reviewDate,
      resultsRecievedDate,
      resultInterpretations: resultInterpretationDisplays,
      performingLabAddress: formatPerformingLabAddress(organization),
      performingLabDirectorFullName: formatPerformingLabDirectorName(organization),
    },
  };
  const commonResources: CommonDataConfigResources = {
    location,
    timezone,
    serviceRequest,
    patient,
    diagnosticReport,
    providerName: getFullestAvailableName(provider),
    testName: diagnosticReport.code.coding?.[0].display,
  };
  const dataConfig = getResultDataConfig(commonResources, externalSpecificResources);
  const pdfDetail = await createLabsResultsFormPDF(dataConfig, patient.id, secrets, token);

  await makeLabPdfDocumentReference({
    oystehr,
    type: 'results',
    pdfInfo: pdfDetail,
    patientID: patient.id,
    encounterID: encounter.id,
    diagnosticReportID: diagnosticReport.id,
    reviewed,
    listResources: [],
  });
}

export async function createInHouseLabResultPDF(
  oystehr: Oystehr,
  serviceRequest: ServiceRequest,
  encounter: Encounter,
  patient: Patient,
  location: Location | undefined,
  schedule: Schedule,
  attendingPractitioner: Practitioner,
  attendingPractitionerName: string | undefined,
  inputRequestTask: Task,
  observations: Observation[],
  diagnosticReport: DiagnosticReport,
  secrets: Secrets | null,
  token: string,
  activityDefinition: ActivityDefinition,
  serviceRequestsRelatedViaRepeat: ServiceRequest[] | undefined,
  specimen: Specimen
): Promise<void> {
  console.log('starting create inhouse lab result pdf');
  if (!encounter.id) throw new Error('encounter id is undefined');
  if (!patient.id) throw new Error('patient.id is undefined');

  // todo will probably need to update to accomodate a more resilient method of fetching timezone
  let timezone = undefined;
  if (schedule) {
    timezone = getTimezone(schedule);
  }

  const inHouseLabResults = await getFormattedInHouseLabResults(
    oystehr,
    activityDefinition,
    observations,
    specimen,
    inputRequestTask,
    timezone
  );

  let additionalResultsForRelatedSrs: InHouseLabResultConfig[] = [];
  if (serviceRequestsRelatedViaRepeat) {
    console.log('configuring additional results for related repeat tests');
    additionalResultsForRelatedSrs = await getAdditionalResultsForRepeats(
      oystehr,
      serviceRequestsRelatedViaRepeat,
      activityDefinition,
      timezone
    );
  }

  const inhouseSpecificResources: LabTypeSpecificResources = {
    type: LabType.inHouse,
    specificResources: { inHouseLabResults: [inHouseLabResults, ...additionalResultsForRelatedSrs] },
  };
  const commonResources: CommonDataConfigResources = {
    location,
    timezone,
    serviceRequest,
    patient,
    diagnosticReport,
    providerName: attendingPractitionerName,
    testName: activityDefinition.title,
  };
  const dataConfig = getResultDataConfig(commonResources, inhouseSpecificResources);

  const pdfDetail = await createLabsResultsFormPDF(dataConfig, patient.id, secrets, token);

  await makeLabPdfDocumentReference({
    oystehr,
    type: 'results',
    pdfInfo: pdfDetail,
    patientID: patient.id,
    encounterID: encounter.id,
    diagnosticReportID: diagnosticReport.id,
    reviewed: false,
    listResources: [], // this needs to be passed so the helper returns docRefs
  });
}

async function createLabsResultsFormPdfBytes(dataConfig: ResultDataConfig): Promise<Uint8Array> {
  const { type, data } = dataConfig;

  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const callIcon = await pdfClient.embedImage(fs.readFileSync('./assets/call.png'));
  const faxIcon = await pdfClient.embedImage(fs.readFileSync('./assets/fax.png'));
  const textStyles = await getTextStylesForLabsPDF(pdfClient);

  // draw header which is same for external and in house at the moment
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
  pdfClient.newLine(STANDARD_NEW_LINE);

  const locationCityStateZip = `${data.locationCity?.toUpperCase() || ''}${data.locationCity ? ', ' : ''}${
    data.locationState?.toUpperCase() || ''
  }${data.locationState ? ' ' : ''}${data.locationZip?.toUpperCase() || ''}`;

  pdfClient.drawText(`${data.patientDOB}, ${calculateAge(data.patientDOB)} Y, ${data.patientSex}`, textStyles.text);
  pdfClient.drawText(locationCityStateZip, textStyles.textRight);

  pdfClient.newLine(STANDARD_NEW_LINE);

  pdfClient.drawText(`ID: ${data.patientId}`, textStyles.text);

  let margin =
    pdfClient.getRightBound() -
    pdfClient.getLeftBound() -
    ICON_STYLE.width -
    pdfClient.getTextDimensions(` ${data.locationPhone}`, textStyles.text).width -
    5;

  if (data.locationFax) {
    margin -= ICON_STYLE.width + pdfClient.getTextDimensions(` ${data.locationFax}`, textStyles.text).width + 10;
  }

  let iconStyleTemp = { ...ICON_STYLE, margin: { left: margin } };
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
        ICON_STYLE.width -
        pdfClient.getTextDimensions(` ${data.locationFax}`, textStyles.text).width -
        5;
    }
    iconStyleTemp = { ...iconStyleTemp, margin: { left: margin } };
    pdfClient.drawImage(faxIcon, iconStyleTemp, textStyles.text);
    pdfClient.drawTextSequential(` ${data.locationFax}`, textStyles.text);
  }

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawText(data.patientPhone, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawText(`${data.resultStatus} RESULT`, textStyles.headerRight);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  // draw the rest of the pdf which is specific to the type of lab request
  let pdfBytes: Uint8Array | undefined;
  if (type === LabType.external) {
    pdfBytes = await createExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data);
  } else if (type === LabType.inHouse) {
    pdfBytes = await createInHouseLabsResultsFormPdfBytes(pdfClient, textStyles, data);
  }
  if (!pdfBytes) throw new Error('pdfBytes could not be drawn');
  return pdfBytes;
}

async function createExternalLabsResultsFormPdfBytes(
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  data: ExternalLabResultsData
): Promise<Uint8Array> {
  // Order details
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Accession ID:', data.accessionNumber);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Requesting Physician:', data.providerName);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Ordering Physician:', data.providerName);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Number:', data.orderNumber);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Priority:', data.orderPriority.toUpperCase());
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Date:', data.orderSubmitDate);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Collection Date:', data.collectionDate);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Results Date:', data.resultsRecievedDate);
  pdfClient.newLine(STANDARD_FONT_SIZE);
  pdfClient.newLine(STANDARD_FONT_SIZE);

  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  pdfClient = drawFieldLine(
    pdfClient,
    textStyles,
    'Dx:',
    data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', ')
  );
  pdfClient.newLine(30);
  pdfClient.drawText(data.testName.toUpperCase(), textStyles.header);

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  pdfClient = drawFourColumnText(
    pdfClient,
    textStyles,
    { name: '', startXPos: 0 },
    { name: 'NAME', startXPos: 70 },
    { name: 'VALUE', startXPos: 340 },
    { name: 'LAB', startXPos: 490 }
  );
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient = drawFourColumnText(
    pdfClient,
    textStyles,
    { name: data.resultPhase, startXPos: 0 },
    { name: data.testName.toUpperCase(), startXPos: 70 },
    { name: getResultValueToDiplay(data.resultInterpretations), startXPos: 340 },
    { name: data.testItemCode, startXPos: 490 },
    getResultRowDisplayColor(data.resultInterpretations)
  );
  pdfClient.newLine(STANDARD_NEW_LINE);
  for (const labResult of data.externalLabResults) {
    pdfClient.newLine(14);
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    pdfClient.newLine(5);
    pdfClient.drawText(`Code: ${labResult.resultCode} (${labResult.resultCodeDisplay})`, textStyles.text);
    if (labResult.resultInterpretation && labResult.resultInterpretationDisplay) {
      pdfClient.newLine(STANDARD_NEW_LINE);
      const fontStyleTemp = {
        ...textStyles.text,
        color: getResultRowDisplayColor([labResult.resultInterpretationDisplay]),
      };
      pdfClient.drawText(
        `Interpretation: ${labResult.resultInterpretation} (${labResult.resultInterpretationDisplay})`,
        fontStyleTemp
      );
    }
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawText(`Value: ${labResult.resultValue}`, textStyles.text);

    if (labResult.referenceRangeText) {
      pdfClient.newLine(STANDARD_NEW_LINE);
      pdfClient.drawText(`Reference range: ${labResult.referenceRangeText}`, textStyles.text);
    }

    // add any notes included for the observation
    if (labResult.resultNotes?.length) {
      pdfClient.newLine(STANDARD_NEW_LINE);
      pdfClient.drawText('Notes:', textStyles.textBold);
      pdfClient.newLine(STANDARD_NEW_LINE);

      labResult.resultNotes?.forEach((note) => {
        const noteLines = note.split('\n');

        noteLines.forEach((noteLine) => {
          if (noteLine === '') pdfClient.newLine(STANDARD_NEW_LINE);
          else {
            // adding a little bit of a left indent for notes
            pdfClient.drawTextSequential(noteLine, textStyles.text, 50);
            pdfClient.newLine(STANDARD_NEW_LINE);
          }
        });

        pdfClient.newLine(STANDARD_NEW_LINE);
      });
    }
  }

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Performing lab details
  pdfClient.drawText(`PERFORMING LAB: ${data.performingLabName}`, textStyles.textRight);
  if (data.performingLabAddress) {
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawText(data.performingLabAddress, textStyles.textRight);
  }
  pdfClient.newLine(STANDARD_NEW_LINE);

  if (data.performingLabDirectorFullName && data.performingLabPhone) {
    pdfClient.drawText(`${data.performingLabDirectorFullName}, ${data.performingLabPhone}`, textStyles.textRight);
    pdfClient.newLine(STANDARD_NEW_LINE);
  } else if (data.performingLabDirectorFullName) {
    pdfClient.drawText(data.performingLabDirectorFullName, textStyles.textRight);
    pdfClient.newLine(STANDARD_NEW_LINE);
  } else if (data.performingLabPhone) {
    pdfClient.drawText(data.performingLabPhone, textStyles.textRight);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  // Reviewed by
  if (data.reviewed) {
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    pdfClient.newLine(STANDARD_NEW_LINE);
    const name = data.reviewingProvider ? getFullestAvailableName(data.reviewingProvider) : '';
    pdfClient = drawFieldLine(pdfClient, textStyles, `Reviewed: ${data.reviewDate} by`, name || '');
  }

  return await pdfClient.save();
}

async function createInHouseLabsResultsFormPdfBytes(
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  data: InHouseLabResultsData
): Promise<Uint8Array> {
  // Order details
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Number:', data.serviceRequestID);
  pdfClient.newLine(STANDARD_FONT_SIZE + 4);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Ordering Physician:', data.providerName);
  pdfClient.newLine(STANDARD_FONT_SIZE + 4);
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Date:', data.orderCreateDate);
  pdfClient.newLine(STANDARD_FONT_SIZE + 4);
  pdfClient.drawText('IQC Valid', textStyles.textBold);
  pdfClient.newLine(STANDARD_FONT_SIZE + 4);

  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  pdfClient = drawFieldLine(
    pdfClient,
    textStyles,
    'Dx:',
    data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join(', ')
  );
  pdfClient.newLine(30);

  for (const labResult of data.inHouseLabResults) {
    pdfClient.drawText(data.testName.toUpperCase(), textStyles.header);

    pdfClient = drawFieldLine(pdfClient, textStyles, 'Specimen source:', labResult.specimenSource);
    pdfClient.newLine(STANDARD_FONT_SIZE);

    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

    const resultHasUnits = labResult.results.some((result) => result.units);
    pdfClient = drawFourColumnText(
      pdfClient,
      textStyles,
      { name: 'NAME', startXPos: 0 },
      { name: 'VALUE', startXPos: 230 },
      { name: resultHasUnits ? 'UNITS' : '', startXPos: 350 },
      { name: 'REFERENCE RANGE', startXPos: 410 }
    );
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    for (const resultDetail of labResult.results) {
      let resultRange = undefined;
      if (resultDetail.rangeString) {
        resultRange = resultDetail.rangeString.join(', ');
      } else if (resultDetail.rangeQuantity) {
        resultRange = quantityRangeFormat(resultDetail.rangeQuantity);
      } else {
        resultRange = '';
      }

      const valueStringToWrite =
        resultDetail.value === IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode ? 'Inconclusive' : resultDetail.value;
      pdfClient = drawFourColumnText(
        pdfClient,
        textStyles,
        { name: resultDetail.name, startXPos: 0 },
        { name: valueStringToWrite || '', startXPos: 230 },
        { name: resultDetail.units || '', startXPos: 350 },
        { name: resultRange, startXPos: 410 },
        getInHouseResultRowDisplayColor(resultDetail)
      );
      pdfClient.newLine(STANDARD_NEW_LINE);
      pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    }
    pdfClient = drawFieldLineRight(pdfClient, textStyles, 'Collection Date:', labResult.collectionDate);
    pdfClient.newLine(STANDARD_FONT_SIZE + 3);
    pdfClient = drawFieldLineRight(pdfClient, textStyles, 'Results Date:', labResult.finalResultDateTime);
    pdfClient.newLine(24);
  }

  return await pdfClient.save();
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
    return LAB_PDF_STYLES.color.black;
  } else {
    return LAB_PDF_STYLES.color.red;
  }
}

function getInHouseResultRowDisplayColor(labResult: InHouseLabResult): Color {
  console.log('>>>in getInHouseReslutRowDisplayCOlor, this is the result value ', labResult.value);
  if (
    (labResult.value && labResult.rangeString?.includes(labResult.value)) ||
    labResult.value === IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode
  ) {
    return LAB_PDF_STYLES.color.black;
  } else if (labResult.type === 'Quantity') {
    if (labResult.value && labResult.rangeQuantity) {
      const value = parseFloat(labResult.value);
      const { low, high } = labResult.rangeQuantity.normalRange;
      if (value >= low && value <= high) {
        return LAB_PDF_STYLES.color.black;
      }
    }
    return LAB_PDF_STYLES.color.red;
  }
  return LAB_PDF_STYLES.color.red;
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

async function createLabsResultsFormPDF(
  dataConfig: ResultDataConfig,
  patientID: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating labs order form pdf bytes');
  const pdfBytes = await createLabsResultsFormPdfBytes(dataConfig).catch((error) => {
    throw new Error('failed creating labs order form pdfBytes: ' + error.message);
  });

  console.debug(`Created external labs order form pdf bytes`);
  const bucketName = 'visit-notes';
  let fileName = undefined;
  const { type, data } = dataConfig;
  if (type === 'external') {
    fileName = `${EXTERNAL_LAB_RESULT_PDF_BASE_NAME}-${data.resultStatus}${
      data.resultStatus === 'preliminary' ? '' : data.reviewed ? '-reviewed' : '-unreviewed'
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

const getFormattedInHouseLabResults = async (
  oystehr: Oystehr,
  activityDefinition: ActivityDefinition,
  observations: Observation[],
  specimen: Specimen,
  task: Task,
  timezone: string | undefined
): Promise<InHouseLabResultConfig> => {
  if (!specimen?.collection?.collectedDateTime) {
    throw new Error('in-house lab collection date is not defined');
  }

  const specimenSource = specimen?.collection?.bodySite?.coding?.map((coding) => coding.display).join(', ') || '';
  const { reviewDate: finalResultDateTime } = await getTaskCompletedByAndWhen(oystehr, task, timezone);

  const collectionDate = DateTime.fromISO(specimen?.collection?.collectedDateTime)
    .setZone(timezone)
    .toFormat(LABS_DATE_STRING_FORMAT);

  const results: InHouseLabResult[] = [];
  const components = convertActivityDefinitionToTestItem(activityDefinition, observations).components;
  const componentsAll: TestItemComponent[] = [...components.radioComponents, ...components.groupedComponents];
  componentsAll.forEach((item) => {
    if (item.dataType === 'CodeableConcept') {
      results.push({
        name: item.componentName,
        type: item.dataType,
        value: item.result?.entry !== undefined ? item.result?.entry : '',
        units: item.unit,
        rangeString: item.valueSet
          .filter((value) => !item.abnormalValues.map((val) => val.code).includes(value.code))
          .map((value) => value.display),
      });
    } else if (item.dataType === 'Quantity') {
      results.push({
        name: item.componentName,
        type: item.dataType,
        value: item.result?.entry,
        units: item.unit,
        rangeQuantity: item,
      });
    }
  });

  const resultConfig: InHouseLabResultConfig = {
    collectionDate,
    finalResultDateTime,
    specimenSource,
    results,
  };

  return resultConfig;
};

const getAdditionalResultsForRepeats = async (
  oystehr: Oystehr,
  repeatTestingSrs: ServiceRequest[],
  activityDefinition: ActivityDefinition,
  timezone: string | undefined
): Promise<InHouseLabResultConfig[]> => {
  const { srResourceMap } = await fetchResultResourcesForRepeatServiceRequest(oystehr, repeatTestingSrs);
  const configs: InHouseLabResultConfig[] = [];

  for (const [srId, resources] of Object.entries(srResourceMap)) {
    const { observations, tasks, specimens } = resources;
    const inputRequestTask = tasks.find(
      (task) => task.code?.coding?.some((c) => c.code === IN_HOUSE_LAB_TASK.code.inputResultsTask)
    );
    const specimen = specimens[0];
    if (!inputRequestTask || !specimen) {
      throw new Error(`issue getting inputRequestTask or specimen for repeat service request: ${srId}`);
    }
    const config = await getFormattedInHouseLabResults(
      oystehr,
      activityDefinition,
      observations,
      specimen,
      inputRequestTask,
      timezone
    );
    configs.push(config);
  }
  return configs;
};

const formatPerformingLabAddress = (org: Organization | undefined): string | undefined => {
  if (!org?.address?.[0]) return;
  const address = org.address?.[0];
  const streetAddress = address.line?.join(',');
  const { city, state, postalCode } = address;
  if (!streetAddress && !city && !state && !postalCode) return;
  let formattedAddress = `${streetAddress}`;
  if (city) formattedAddress += `, ${city}`;
  if (state) formattedAddress += `, ${state}`;
  if (postalCode) formattedAddress += ` ${postalCode}`;
  console.log('formattedAddress', formattedAddress);
  return formattedAddress;
};

const formatPerformingLabDirectorName = (org: Organization | undefined): string => {
  if (!org) return ''; // this would be very strange to happen
  const labDirectorName = org?.contact?.find(
    (temp) => temp.purpose?.coding?.find((purposeTemp) => purposeTemp.code === 'lab_director')
  )?.name;
  if (!labDirectorName) return '';
  let formattedName = labDirectorName.given?.join(',');
  if (formattedName && labDirectorName?.family) formattedName += ` ${labDirectorName?.family}`;
  return formattedName || '';
};

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
  Patient,
  Practitioner,
  Provenance,
  Reference,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Color } from 'pdf-lib';
import {
  BUCKET_NAMES,
  compareDates,
  convertActivityDefinitionToTestItem,
  createFilesDocumentReferences,
  EXTERNAL_LAB_RESULT_PDF_BASE_NAME,
  getFullestAvailableName,
  getOrderNumber,
  getOrderNumberFromDr,
  getTimezone,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_RESULT_PDF_BASE_NAME,
  IN_HOUSE_LAB_TASK,
  isPSCOrder,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  LabType,
  ObsContentType,
  OYSTEHR_EXTERNAL_LABS_ATTACHMENT_EXT_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_OBR_NOTE_CODING_SYSTEM,
  OYSTEHR_OBS_CONTENT_TYPES,
  PERFORMING_PHYSICIAN_EXTENSION_URLS,
  PERFORMING_SITE_INFO_EXTENSION_URLS,
  PROJECT_NAME,
  quantityRangeFormat,
  Secrets,
  SupportedObsImgAttachmentTypes,
  TestItemComponent,
} from 'utils';
import { fetchResultResourcesForRepeatServiceRequest } from '../../ehr/shared/in-house-labs';
import {
  getExternalLabOrderResourcesViaDiagnosticReport,
  getExternalLabOrderResourcesViaServiceRequest,
} from '../../ehr/shared/labs';
import { LABS_DATE_STRING_FORMAT } from '../../ehr/submit-lab-order/helpers';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { ICON_STYLE, STANDARD_FONT_SIZE, STANDARD_NEW_LINE } from './pdf-consts';
import {
  calculateAge,
  drawFieldLine,
  drawFieldLineRight,
  drawFourColumnText,
  getPdfClientForLabsPDFs,
  LAB_PDF_STYLES,
  LabsPDFTextStyleConfig,
  PdfInfo,
  SEPARATED_LINE_STYLE,
} from './pdf-utils';
import {
  ExternalLabResult,
  ExternalLabResultAttachments,
  ExternalLabResultsData,
  InHouseLabResult,
  InHouseLabResultConfig,
  InHouseLabResultsData,
  LabResultsData,
  PdfClient,
  ReflexExternalLabResultsData,
  ResultDataConfig,
  UnsolicitedExternalLabResultsData,
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

type ExternalLabSpecificResources = {
  externalLabResults: ExternalLabResult[];
  collectionDate: string;
  orderSubmitDate: string;
  reviewed: boolean;
  reviewingProvider: Practitioner | undefined;
  reviewDate: string | undefined;
  resultsReceivedDate: string;
  resultInterpretations: string[];
  attachments: ExternalLabResultAttachments;
};

type LabTypeSpecificResources =
  | {
      type: LabType.external;
      specificResources: ExternalLabSpecificResources;
    }
  | { type: LabType.inHouse; specificResources: { inHouseLabResults: InHouseLabResultConfig[] } }
  | {
      type: LabType.unsolicited | LabType.reflex;
      specificResources: Omit<ExternalLabSpecificResources, 'collectionDate' | 'orderSubmitDate'> & {
        testName: string | undefined;
        patient: Patient;
        diagnosticReport: DiagnosticReport;
      };
    };

const getResultDataConfigForDrResources = (
  specificResourceConfig: Extract<LabTypeSpecificResources, { type: LabType.unsolicited | LabType.reflex }>,
  type: LabType
): ResultDataConfig => {
  console.log('configuring diagnostic report result data to create pdf');
  const now = DateTime.now();

  const { specificResources } = specificResourceConfig;

  console.log('configuring data for drawing pdf');

  const {
    testName,
    diagnosticReport,
    patient,
    externalLabResults,
    reviewed,
    reviewingProvider,
    reviewDate,
    resultsReceivedDate,
    resultInterpretations,
    attachments,
  } = specificResources;

  const baseData: LabResultsData = {
    locationName: undefined,
    locationStreetAddress: undefined,
    locationCity: undefined,
    locationState: undefined,
    locationZip: undefined,
    locationPhone: undefined,
    locationFax: undefined,
    providerName: '',
    patientFirstName: patient.name?.[0].given?.[0] || '',
    patientMiddleName: patient.name?.[0].given?.[1],
    patientLastName: patient.name?.[0].family || '',
    patientSex: patient.gender || '',
    patientDOB: patient.birthDate ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy') : '',
    patientId: patient.id || '',
    patientPhone: patient.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value || '',
    todayDate: now.setZone().toFormat(LABS_DATE_STRING_FORMAT),
    dateIncludedInFileName: diagnosticReport.effectiveDateTime || '',
    orderPriority: '',
    testName: testName || '',
    orderAssessments: [],
    resultStatus: diagnosticReport.status.toUpperCase(),
    isPscOrder: false,
  };

  const unsolicitedResultData: Omit<UnsolicitedExternalLabResultsData, keyof LabResultsData> = {
    accessionNumber: diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')?.value || '',
    resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || '',
    reviewed,
    reviewingProvider,
    reviewDate,
    resultInterpretations,
    attachments,
    externalLabResults,
    testItemCode:
      diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
      diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
      '',
    resultsReceivedDate,
  };

  if (type === LabType.reflex) {
    console.log('reflex result pdf to be made');
    const orderNumber = getOrderNumberFromDr(diagnosticReport) || '';
    const reflexResultData: Omit<ReflexExternalLabResultsData, keyof LabResultsData> = {
      ...unsolicitedResultData,
      orderNumber,
    };
    const data = { ...baseData, ...reflexResultData };
    const config: ResultDataConfig = { type, data };
    return config;
  } else if (type === LabType.unsolicited) {
    console.log('unsolicited result pdf to be made');
    const data: UnsolicitedExternalLabResultsData = { ...baseData, ...unsolicitedResultData };
    const config: ResultDataConfig = { type, data };
    return config;
  }

  throw Error(`an unexpected type was passed: ${type}`);
};

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

  const baseData: LabResultsData = {
    locationName: location?.name,
    locationStreetAddress: location?.address?.line?.join(','),
    locationCity: location?.address?.city,
    locationState: location?.address?.state,
    locationZip: location?.address?.postalCode,
    locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value,
    locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value,
    providerName: providerName || '',
    patientFirstName: patient.name?.[0].given?.[0] || '',
    patientMiddleName: patient.name?.[0].given?.[1],
    patientLastName: patient.name?.[0].family || '',
    patientSex: patient.gender || '',
    patientDOB: patient.birthDate ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy') : '',
    patientId: patient.id || '',
    patientPhone: patient.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value || '',
    todayDate: now.setZone().toFormat(LABS_DATE_STRING_FORMAT),
    dateIncludedInFileName: serviceRequest.authoredOn || '',
    orderPriority: serviceRequest.priority || '',
    testName: testName || '',
    orderAssessments:
      serviceRequest?.reasonCode?.map((code) => ({
        code: code.coding?.[0].code || '',
        name: code.text || '',
      })) || [],
    resultStatus: diagnosticReport.status.toUpperCase(),
    isPscOrder: isPSCOrder(serviceRequest),
  };

  if (type === LabType.inHouse) {
    const { inHouseLabResults } = specificResources;
    const orderCreateDate = serviceRequest.authoredOn
      ? DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
      : '';
    const inHouseData: Omit<InHouseLabResultsData, keyof LabResultsData> = {
      inHouseLabResults,
      timezone,
      serviceRequestID: serviceRequest.id || '',
      orderCreateDate,
    };
    const data: InHouseLabResultsData = { ...baseData, ...inHouseData };
    config = { type: LabType.inHouse, data };
  }

  if (type === LabType.external) {
    const {
      externalLabResults,
      collectionDate,
      orderSubmitDate,
      reviewed,
      reviewingProvider,
      reviewDate,
      resultsReceivedDate,
      resultInterpretations,
      attachments,
    } = specificResources;
    const orderNumber = getOrderNumber(serviceRequest);
    if (!orderNumber) throw Error(`order number could not be parsed from the service request ${serviceRequest.id}`);
    const externalLabData: Omit<ExternalLabResultsData, keyof LabResultsData> = {
      orderNumber,
      accessionNumber: diagnosticReport.identifier?.find((item) => item.type?.coding?.[0].code === 'FILL')?.value || '',
      collectionDate,
      orderSubmitDate,
      resultPhase: diagnosticReport.status.charAt(0).toUpperCase() || '',
      reviewed,
      reviewingProvider,
      reviewDate,
      resultInterpretations,
      attachments,
      externalLabResults,
      testItemCode:
        diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
        diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
        '',
      resultsReceivedDate,
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

export function getLabFileName(labName: string): string {
  return labName.replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

const getTaskCompletedByAndWhen = async (
  oystehr: Oystehr,
  task: Task
): Promise<{
  reviewingProvider: Practitioner;
  reviewDate: DateTime;
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

  const reviewDate = DateTime.fromISO(taskProvenance.recorded);

  return {
    reviewingProvider: taskPractitioner,
    reviewDate,
  };
};

export async function createExternalLabResultPDFBasedOnDr(
  oystehr: Oystehr,
  type: 'reflex' | 'unsolicited',
  diagnosticReportID: string,
  reviewed: boolean,
  secrets: Secrets | null,
  token: string
): Promise<void> {
  const { patient, diagnosticReport, observations } = await getExternalLabOrderResourcesViaDiagnosticReport(
    oystehr,
    diagnosticReportID
  );

  if (!patient.id) throw new Error('patient.id is undefined');

  const {
    reviewingProvider,
    reviewDate,
    externalLabResults,
    resultsReceivedDate,
    resultInterpretationDisplays,
    obsAttachments,
  } = await getResultsDetailsForPDF(oystehr, diagnosticReport, observations);

  const externalSpecificResources: LabTypeSpecificResources = {
    type: type === 'reflex' ? LabType.reflex : LabType.unsolicited,
    specificResources: {
      testName: diagnosticReport.code.coding?.[0].display,
      patient,
      diagnosticReport,
      externalLabResults,
      reviewed,
      reviewingProvider,
      reviewDate: reviewDate?.toFormat(LABS_DATE_STRING_FORMAT),
      resultsReceivedDate,
      resultInterpretations: resultInterpretationDisplays,
      attachments: obsAttachments,
    },
  };

  const dataConfig = getResultDataConfigForDrResources(externalSpecificResources, LabType[type]);
  const pdfDetail = await createLabsResultsFormPDF(dataConfig, patient.id, secrets, token);

  await makeLabPdfDocumentReference({
    oystehr,
    type,
    pdfInfo: pdfDetail,
    patientID: patient.id,
    encounterID: undefined,
    related: makeRelatedForLabsPDFDocRef({ diagnosticReportId: diagnosticReportID }),
    diagnosticReportID,
    reviewed,
    listResources: [],
  });
}

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
    preSubmissionTask: pstTask,
    encounter,
    schedule,
    // labOrganization,
    observations,
    specimens,
  } = await getExternalLabOrderResourcesViaServiceRequest(oystehr, serviceRequestID);

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

  if (!encounter.id) throw new Error('encounter id is undefined');
  if (!patient.id) throw new Error('patient.id is undefined');
  if (!diagnosticReport.id) throw new Error('diagnosticReport id is undefined');

  const { reviewDate: orderSubmitDate } = await getTaskCompletedByAndWhen(oystehr, pstTask);

  const {
    reviewingProvider,
    reviewDate,
    externalLabResults,
    resultsReceivedDate,
    resultInterpretationDisplays,
    obsAttachments,
  } = await getResultsDetailsForPDF(oystehr, diagnosticReport, observations);

  const sortedSpecimens = specimens?.sort((a, b) =>
    compareDates(a.collection?.collectedDateTime, b.collection?.collectedDateTime)
  );

  // we want the earliest date, and the sort puts cruft at the end
  let specimenCollectionDate: string | undefined;
  for (let i = sortedSpecimens.length - 1; i >= 0; i--) {
    const date = sortedSpecimens[i]?.collection?.collectedDateTime;
    if (date) {
      specimenCollectionDate = date;
      break;
    }
  }

  const collectionDate = specimenCollectionDate
    ? DateTime.fromISO(specimenCollectionDate).setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT)
    : '';

  const externalSpecificResources: LabTypeSpecificResources = {
    type: LabType.external,
    specificResources: {
      externalLabResults,
      collectionDate,
      orderSubmitDate: orderSubmitDate.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
      reviewed,
      reviewingProvider,
      reviewDate: reviewDate?.setZone(timezone).toFormat(LABS_DATE_STRING_FORMAT),
      resultsReceivedDate,
      resultInterpretations: resultInterpretationDisplays,
      attachments: obsAttachments,
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
    related: makeRelatedForLabsPDFDocRef({ diagnosticReportId: diagnosticReport.id }),
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
  _attendingPractitioner: Practitioner,
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
  console.log('starting create in-house lab result pdf');
  if (!encounter.id) throw new Error('encounter id is undefined');
  if (!patient.id) throw new Error('patient.id is undefined');

  // todo will probably need to update to accommodate a more resilient method of fetching timezone
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

  const allResults = [inHouseLabResults, ...additionalResultsForRelatedSrs];
  const allResultsSorted = allResults.sort((a, b) =>
    compareDates(a.finalResultDateTime.toISO() || '', b.finalResultDateTime.toISO() || '')
  );

  const inHouseSpecificResources: LabTypeSpecificResources = {
    type: LabType.inHouse,
    specificResources: { inHouseLabResults: allResultsSorted },
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
  const dataConfig = getResultDataConfig(commonResources, inHouseSpecificResources);

  const pdfDetail = await createLabsResultsFormPDF(dataConfig, patient.id, secrets, token);

  await makeLabPdfDocumentReference({
    oystehr,
    type: 'results',
    pdfInfo: pdfDetail,
    patientID: patient.id,
    encounterID: encounter.id,
    related: makeRelatedForLabsPDFDocRef({ diagnosticReportId: diagnosticReport.id || '' }),
    diagnosticReportID: diagnosticReport.id,
    reviewed: false,
    listResources: [], // this needs to be passed so the helper returns docRefs
  });
}

async function getResultsDetailsForPDF(
  oystehr: Oystehr,
  diagnosticReport: DiagnosticReport,
  observations: Observation[]
): Promise<{
  reviewingProvider: Practitioner | undefined;
  reviewDate: DateTime | undefined;
  resultsReceivedDate: string;
  externalLabResults: ExternalLabResult[];
  resultInterpretationDisplays: string[];
  obsAttachments: ExternalLabResultAttachments;
}> {
  // todo i am pretty sure we can get these resources from an earlier call and just pass them in
  // this function is also called for pdf creation with service requests (existing logic)
  // so i will leave the refactor for later atm
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

  let reviewDate: DateTime | undefined = undefined,
    reviewingProvider = undefined,
    resultsReceivedDate = '';

  if (latestReviewTask) {
    resultsReceivedDate = latestReviewTask?.authoredOn
      ? DateTime.fromISO(latestReviewTask.authoredOn).toFormat(LABS_DATE_STRING_FORMAT)
      : '';
    if (latestReviewTask.status === 'completed') {
      ({ reviewingProvider, reviewDate } = await getTaskCompletedByAndWhen(oystehr, latestReviewTask));
    }
  }
  if (!resultsReceivedDate && !latestReviewTask) {
    console.log('no completed final or corrected tasks, checking ready tasks to parse a results received date');
    const sortedReadyFinalOrCorrected = readyFinalOrCorrected?.sort((a, b) => compareDates(a.authoredOn, b.authoredOn));
    const readyReviewTask = sortedReadyFinalOrCorrected[0];
    if (readyReviewTask && readyReviewTask?.authoredOn) {
      console.log('readyReviewTask: ', readyReviewTask.id);
      resultsReceivedDate = DateTime.fromISO(readyReviewTask.authoredOn).toFormat(LABS_DATE_STRING_FORMAT);
    }
  }

  const resultInterpretationDisplays: string[] = [];
  const externalLabResults: ExternalLabResult[] = [];
  const obsAttachments: ExternalLabResultAttachments = {
    pdfAttachments: [],
    pngAttachments: [],
    jpgAttachments: [],
  };
  observations
    .filter(
      (observation) =>
        diagnosticReport.result?.some((resultTemp) => resultTemp.reference?.split('/')[1] === observation.id)
    )
    .sort((a, b) => {
      // obr notes should be sorted at the top of the observations list
      const aIsObrNote = a.code.coding?.some((c) => c.system === OYSTEHR_OBR_NOTE_CODING_SYSTEM);
      const bIsObrNote = b.code.coding?.some((c) => c.system === OYSTEHR_OBR_NOTE_CODING_SYSTEM);

      if (!aIsObrNote && bIsObrNote) return 1; // a comes before b
      if (aIsObrNote && !bIsObrNote) return -1; // a comes after b
      return 0; // no change
    })
    .forEach((observation) => {
      const { labResult, interpretationDisplay, base64PdfAttachment, base64PngAttachment, base64JpgAttachment } =
        parseObservationForPDF(observation, oystehr);
      externalLabResults.push(labResult);
      if (interpretationDisplay) resultInterpretationDisplays.push(interpretationDisplay);
      if (base64PdfAttachment) obsAttachments.pdfAttachments.push(base64PdfAttachment);
      if (base64PngAttachment) obsAttachments.pngAttachments.push(base64PngAttachment);
      if (base64JpgAttachment) obsAttachments.jpgAttachments.push(base64JpgAttachment);
    });

  return {
    reviewingProvider,
    reviewDate,
    resultsReceivedDate,
    externalLabResults,
    resultInterpretationDisplays,
    obsAttachments,
  };
}

async function createLabsResultsFormPdfBytes(dataConfig: ResultDataConfig): Promise<Uint8Array> {
  const { type, data } = dataConfig;

  const { pdfClient, callIcon, faxIcon, textStyles } = await getPdfClientForLabsPDFs();

  // draw header which is same for external and in house at the moment
  // drawFieldLine('Patient Name:', 'test');
  console.log(
    `Drawing patient name. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  if (data.patientMiddleName) {
    pdfClient.drawText(
      `${data.patientLastName}, ${data.patientFirstName}, ${data.patientMiddleName}`,
      textStyles.textBold
    );
  } else {
    pdfClient.drawText(`${data.patientLastName}, ${data.patientFirstName}`, textStyles.textBold);
  }

  console.log(
    `Drawing location name. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient.drawText(`${PROJECT_NAME ? PROJECT_NAME + ' ' : ''}${data.locationName || ''}`, textStyles.textBoldRight);
  pdfClient.newLine(STANDARD_NEW_LINE);

  const locationCityStateZip = `${data.locationCity?.toUpperCase() || ''}${data.locationCity ? ', ' : ''}${
    data.locationState?.toUpperCase() || ''
  }${data.locationState ? ' ' : ''}${data.locationZip?.toUpperCase() || ''}`;

  console.log(
    `Drawing patient dob and sex. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient.drawText(`${data.patientDOB}, ${calculateAge(data.patientDOB)} Y, ${data.patientSex}`, textStyles.text);
  console.log(
    `Drawing location city, state, zip. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient.drawText(locationCityStateZip, textStyles.textRight);

  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing patient id. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
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
    console.log(
      `Drawing phone. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
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
    console.log(
      `Drawing fax. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
    pdfClient.drawImage(faxIcon, iconStyleTemp, textStyles.text);
    pdfClient.drawTextSequential(` ${data.locationFax}`, textStyles.text);
  }

  console.log(
    `Drawing patient phone. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawText(data.patientPhone, textStyles.text);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing result header. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient.drawText(`${data.resultStatus} RESULT`, textStyles.headerRight);
  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  // draw the rest of the pdf which is specific to the type of lab request
  let pdfBytes: Uint8Array | undefined;
  if (type === LabType.external) {
    console.log('Getting pdf bytes for external lab results');
    pdfBytes = await createExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data);
  } else if (type === LabType.unsolicited || type === LabType.reflex) {
    console.log('Getting pdf bytes for unsolicited external lab results');
    pdfBytes = await createDiagnosticReportExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data);
  } else if (type === LabType.inHouse) {
    console.log('Getting pdf bytes for in house lab results');
    pdfBytes = await createInHouseLabsResultsFormPdfBytes(pdfClient, textStyles, data);
  }
  if (!pdfBytes) throw new Error('pdfBytes could not be drawn');
  return pdfBytes;
}

async function createDiagnosticReportExternalLabsResultsFormPdfBytes(
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  data: UnsolicitedExternalLabResultsData | ReflexExternalLabResultsData
): Promise<Uint8Array> {
  // Order details
  console.log(
    `Drawing accession. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Accession ID:', data.accessionNumber);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // we may map physician info in the future
  // console.log(
  //   `Drawing requesting physician. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  // );
  // pdfClient = drawFieldLine(pdfClient, textStyles, 'Requesting Physician:', data.providerName);
  // pdfClient.newLine(STANDARD_NEW_LINE);

  // console.log(
  //   `Drawing ordering physician. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  // );
  // pdfClient = drawFieldLine(pdfClient, textStyles, 'Ordering Physician:', data.providerName);
  // pdfClient.newLine(STANDARD_NEW_LINE);

  // will only have for reflex
  if ('orderNumber' in data) {
    console.log(
      `Drawing order num. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
    pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Number:', data.orderNumber);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  console.log(
    `Drawing results date. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Results Date:', data.resultsReceivedDate);
  pdfClient.newLine(STANDARD_FONT_SIZE);
  pdfClient.newLine(STANDARD_FONT_SIZE);

  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  pdfClient.newLine(30);
  pdfClient.drawText(data.testName.toUpperCase(), textStyles.header);

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  console.log(
    `Drawing four column text header. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
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

  console.log(
    `Drawing four column text content. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFourColumnText(
    pdfClient,
    textStyles,
    { name: data.resultPhase, startXPos: 0 },
    { name: data.testName.toUpperCase(), startXPos: 70 },
    { name: getResultValueToDisplay(data.resultInterpretations), startXPos: 340 },
    { name: data.testItemCode, startXPos: 490 },
    getResultRowDisplayColor(data.resultInterpretations)
  );
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing results. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  for (const labResult of data.externalLabResults) {
    writeResultDetailLinesInPdf(pdfClient, labResult, textStyles);
  }

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Reviewed by
  if (data.reviewed) {
    console.log(
      `Drawing reviewed by. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    pdfClient.newLine(STANDARD_NEW_LINE);
    const name = data.reviewingProvider ? getFullestAvailableName(data.reviewingProvider) : '';
    pdfClient = drawFieldLine(pdfClient, textStyles, `Reviewed: ${data.reviewDate} by`, name || '');
  }

  const { pdfAttachments, pngAttachments, jpgAttachments } = data.attachments;
  if (pdfAttachments.length > 0) {
    for (const attachmentString of pdfAttachments) {
      await pdfClient.embedPdfFromBase64(attachmentString);
    }
  }
  if (pngAttachments.length > 0) {
    for (const pngAttachmentString of pngAttachments) {
      await pdfClient.embedImageFromBase64(pngAttachmentString, 'PNG');
    }
  }
  if (jpgAttachments.length > 0) {
    for (const jpgAttachmentString of jpgAttachments) {
      await pdfClient.embedImageFromBase64(jpgAttachmentString, 'JPG');
    }
  }

  return await pdfClient.save();
}

async function createExternalLabsResultsFormPdfBytes(
  pdfClient: PdfClient,
  textStyles: LabsPDFTextStyleConfig,
  data: ExternalLabResultsData
): Promise<Uint8Array> {
  // Order details
  console.log(
    `Drawing accession. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Accession ID:', data.accessionNumber);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing requesting physician. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Requesting Physician:', data.providerName);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing ordering physician. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Ordering Physician:', data.providerName);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing order num. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Number:', data.orderNumber);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing order pri. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Priority:', data.orderPriority.toUpperCase());
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing order date. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Order Date:', data.orderSubmitDate);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing collection date. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Collection Date:', data.collectionDate);
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing results date. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(pdfClient, textStyles, 'Results Date:', data.resultsReceivedDate);
  pdfClient.newLine(STANDARD_FONT_SIZE);
  pdfClient.newLine(STANDARD_FONT_SIZE);

  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  console.log(
    `Drawing diagnoses. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFieldLine(
    pdfClient,
    textStyles,
    'Dx:',
    data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join('; ')
  );
  pdfClient.newLine(30);
  pdfClient.drawText(data.testName.toUpperCase(), textStyles.header);

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);

  console.log(
    `Drawing four column text header. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
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

  console.log(
    `Drawing four column text content. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  pdfClient = drawFourColumnText(
    pdfClient,
    textStyles,
    { name: data.resultPhase, startXPos: 0 },
    { name: data.testName.toUpperCase(), startXPos: 70 },
    { name: getResultValueToDisplay(data.resultInterpretations), startXPos: 340 },
    { name: data.testItemCode, startXPos: 490 },
    getResultRowDisplayColor(data.resultInterpretations)
  );
  pdfClient.newLine(STANDARD_NEW_LINE);

  console.log(
    `Drawing results. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  for (const labResult of data.externalLabResults) {
    writeResultDetailLinesInPdf(pdfClient, labResult, textStyles);
  }

  pdfClient.newLine(STANDARD_NEW_LINE);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
  pdfClient.newLine(STANDARD_NEW_LINE);

  // Reviewed by
  if (data.reviewed) {
    console.log(
      `Drawing reviewed by. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
    pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
    pdfClient.newLine(STANDARD_NEW_LINE);
    const name = data.reviewingProvider ? getFullestAvailableName(data.reviewingProvider) : '';
    pdfClient = drawFieldLine(pdfClient, textStyles, `Reviewed: ${data.reviewDate} by`, name || '');
  }

  const { pdfAttachments, pngAttachments, jpgAttachments } = data.attachments;
  if (pdfAttachments.length > 0) {
    for (const attachmentString of pdfAttachments) {
      await pdfClient.embedPdfFromBase64(attachmentString);
    }
  }
  if (pngAttachments.length > 0) {
    for (const pngAttachmentString of pngAttachments) {
      await pdfClient.embedImageFromBase64(pngAttachmentString, 'PNG');
    }
  }
  if (jpgAttachments.length > 0) {
    for (const jpgAttachmentString of jpgAttachments) {
      await pdfClient.embedImageFromBase64(jpgAttachmentString, 'JPG');
    }
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
    data.orderAssessments.length
      ? data.orderAssessments.map((assessment) => `${assessment.code} (${assessment.name})`).join('; ')
      : 'Not specified'
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
    pdfClient = drawFieldLineRight(
      pdfClient,
      textStyles,
      'Results Date:',
      labResult.finalResultDateTime.setZone(data.timezone).toFormat(LABS_DATE_STRING_FORMAT)
    );
    pdfClient.newLine(24);
  }

  return await pdfClient.save();
}

function getResultValueToDisplay(resultInterpretations: string[]): string {
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
  console.log('>>>in getInHouseResultRowDisplayColor, this is the result value ', labResult.value);
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
  const bucketName = BUCKET_NAMES.LABS;
  let fileName = undefined;
  const { type, data } = dataConfig;
  if (type === 'external' || type === 'unsolicited' || type === 'reflex') {
    fileName = generateLabResultFileName(
      type,
      dataConfig.data.testName,
      dataConfig.data.dateIncludedInFileName,
      data.resultStatus,
      !!data.reviewed
    );
  } else if (type === 'in-house') {
    fileName = `${IN_HOUSE_LAB_RESULT_PDF_BASE_NAME}-${getLabFileName(dataConfig.data.testName)}-${DateTime.fromISO(
      dataConfig.data.dateIncludedInFileName
    ).toFormat('yyyy-MM-dd')}-${dataConfig.data.resultStatus}.pdf`;
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

function generateLabResultFileName(
  type: string,
  testName: string,
  dateIncludedInFileName: string,
  resultStatus: string,
  reviewed: boolean
): string {
  const typeForUrl = (() => {
    switch (type) {
      case 'unsolicited':
        return 'Unsolicited-';
      case 'reflex':
        return 'Reflex-';
      default:
        return '';
    }
  })();
  const formattedTestName = testName ? `-${getLabFileName(testName)}` : '';
  const formattedDate = dateIncludedInFileName
    ? `-${DateTime.fromISO(dateIncludedInFileName).toFormat('yyyy-MM-dd')}`
    : '';
  const reviewStatus = (() => {
    if (resultStatus === 'preliminary') return '';
    return reviewed ? '-reviewed' : '-unreviewed';
  })();

  return `${typeForUrl}${EXTERNAL_LAB_RESULT_PDF_BASE_NAME}${formattedTestName}${formattedDate}-${resultStatus}${reviewStatus}.pdf`;
}

export async function makeLabPdfDocumentReference({
  oystehr,
  type,
  pdfInfo,
  patientID,
  encounterID,
  related,
  listResources,
  diagnosticReportID,
  reviewed,
}: {
  oystehr: Oystehr;
  type: 'order' | 'results' | 'unsolicited' | 'reflex';
  pdfInfo: PdfInfo;
  patientID: string;
  encounterID: string | undefined; // will be undefined for unsolicited results;
  related: Reference[];
  listResources?: List[] | undefined;
  diagnosticReportID?: string;
  reviewed?: boolean;
}): Promise<DocumentReference> {
  if (type !== 'unsolicited' && type !== 'reflex' && !encounterID) {
    throw Error('encounterID is required for solicited results and order document references');
  }

  let docType;
  if (type === 'results' || type === 'unsolicited' || type === 'reflex') {
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

  const docRefContext: DocumentReference['context'] = {
    related,
  };
  if (encounterID) {
    docRefContext.encounter = [{ reference: `Encounter/${encounterID}` }];
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
      context: docRefContext,
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

type LabDocRelatedReferenceInput = { serviceRequestIds: string[] } | { diagnosticReportId: string };
export const makeRelatedForLabsPDFDocRef = (input: LabDocRelatedReferenceInput): Reference[] => {
  if ('serviceRequestIds' in input) {
    return input.serviceRequestIds.map((id) => ({
      reference: `ServiceRequest/${id}`,
    }));
  } else {
    return [
      {
        reference: `DiagnosticReport/${input.diagnosticReportId}`,
      },
    ];
  }
};

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
  const { reviewDate: finalResultDateTime } = await getTaskCompletedByAndWhen(oystehr, task);

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

const parseObservationForPDF = (
  observation: Observation,
  oystehr: Oystehr
): {
  labResult: ExternalLabResult;
  interpretationDisplay: string | undefined;
  base64PdfAttachment?: string;
  base64PngAttachment?: string;
  base64JpgAttachment?: string;
} => {
  const base64PdfAttachment = checkObsForAttachment(observation, OYSTEHR_OBS_CONTENT_TYPES.pdf);
  const base64PngAttachment = checkObsForAttachment(observation, OYSTEHR_OBS_CONTENT_TYPES.image, ['PNG']);
  const base64JpgAttachment = checkObsForAttachment(observation, OYSTEHR_OBS_CONTENT_TYPES.image, ['JPG', 'JPEG']);
  if (base64PdfAttachment || base64PngAttachment || base64JpgAttachment) {
    const initialText = base64PdfAttachment ? 'A pdf' : 'An image';
    const attachmentResult: ExternalLabResult = {
      resultCode: '',
      resultCodeDisplay: '',
      resultValue: '',
      attachmentText: `${initialText} attachment is included at the end of this document`,
    };
    return {
      labResult: attachmentResult,
      interpretationDisplay: undefined,
      base64PdfAttachment,
      base64PngAttachment,
      base64JpgAttachment,
    };
  }

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

  const codes = observation.code.coding
    ?.reduce((acc: string[], code) => {
      if (code.system !== OYSTEHR_OBR_NOTE_CODING_SYSTEM) {
        if (code.code) acc.push(code.code);
      }
      return acc;
    }, [])
    .join(',');
  const labResult: ExternalLabResult = {
    resultCode: codes || '',
    resultCodeDisplay: observation.code.coding?.[0].display || '',
    resultInterpretation: observation.interpretation?.[0].coding?.[0].code,
    resultInterpretationDisplay: interpretationDisplay,
    resultValue: value || '',
    referenceRangeText,
    resultNotes: observation.note?.map((note) => note.text),
    performingLabName: getPerformingLabNameFromObs(observation),
    performingLabAddress: getPerformingLabAddressFromObs(observation, oystehr),
    performingLabPhone: getPerformingLabPhoneFromObs(observation),
    performingLabDirectorFullName: getPerformingLabDirectorNameFromObs(observation, oystehr),
  };

  return { labResult, interpretationDisplay };
};

const getPerformingLabNameFromObs = (obs: Observation): string | undefined => {
  const siteExt = obs.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl);
  if (siteExt) {
    const name = siteExt.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.name)?.valueString;
    return name;
  }
  return;
};

const getPerformingLabAddressFromObs = (obs: Observation, oystehr: Oystehr): string | undefined => {
  const siteExt = obs.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl);
  if (siteExt) {
    const address = siteExt.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.address)
      ?.valueAddress;
    if (address) return oystehr.fhir.formatAddress(address);
  }
  return;
};

const getPerformingLabPhoneFromObs = (obs: Observation): string | undefined => {
  const siteExt = obs.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl);
  if (siteExt) {
    const phone = siteExt.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.phone)
      ?.valueContactPoint?.value;
    return phone;
  }
  return;
};

const getPerformingLabDirectorNameFromObs = (obs: Observation, oystehr: Oystehr): string | undefined => {
  const labDirectorExt = obs.extension?.find((ext) => ext.url === PERFORMING_PHYSICIAN_EXTENSION_URLS.parentExtUrl);
  if (labDirectorExt) {
    const humanName = labDirectorExt.extension?.find((ext) => ext.url === PERFORMING_SITE_INFO_EXTENSION_URLS.name)
      ?.valueHumanName;
    if (humanName) return oystehr.fhir.formatHumanName(humanName);
  }
  return;
};

const checkObsForAttachment = (
  obs: Observation,
  obsContentType: ObsContentType,
  imgType?: SupportedObsImgAttachmentTypes[]
): string | undefined => {
  const attachmentExt = obs.extension?.find((ext) => ext.url === OYSTEHR_EXTERNAL_LABS_ATTACHMENT_EXT_SYSTEM)
    ?.valueAttachment;
  const contentTypeCaps = attachmentExt?.contentType?.toUpperCase();

  // logic on the oystehr side is that the file type and and file extension are mapped to the contentType field
  // PDFs should be AP/PDF (where AP designates file type and PDF the file extension)
  // similarly an image could be IM/PNG (where IM indicates an image file and png is the extension)

  if (attachmentExt && contentTypeCaps && contentTypeCaps.startsWith(obsContentType)) {
    if (!imgType) {
      return attachmentExt.data;
    } else {
      for (const type of imgType) {
        if (contentTypeCaps.endsWith(type)) {
          return attachmentExt.data;
        }
      }
    }
  }
  return;
};

const writeResultDetailLinesInPdf = (
  pdfClient: PdfClient,
  labResult: ExternalLabResult,
  textStyles: LabsPDFTextStyleConfig
): void => {
  pdfClient.newLine(14);
  pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
  pdfClient.newLine(5);

  if (labResult.attachmentText) {
    pdfClient.drawText(labResult.attachmentText, textStyles.text);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  let codeText: string | undefined;
  if (labResult.resultCode) {
    codeText = `Code: ${labResult.resultCode}`;
  }
  if (labResult.resultCodeDisplay) {
    codeText += ` (${labResult.resultCodeDisplay})`;
  }
  if (codeText) {
    pdfClient.drawText(codeText, textStyles.text);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  if (labResult.resultInterpretation && labResult.resultInterpretationDisplay) {
    const fontStyleTemp = {
      ...textStyles.text,
      color: getResultRowDisplayColor([labResult.resultInterpretationDisplay]),
    };
    pdfClient.drawText(
      `Interpretation: ${labResult.resultInterpretation} (${labResult.resultInterpretationDisplay})`,
      fontStyleTemp
    );
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  if (labResult.resultValue) {
    pdfClient.drawText(`Value: ${labResult.resultValue}`, textStyles.text);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  if (labResult.referenceRangeText) {
    pdfClient.drawText(`Reference range: ${labResult.referenceRangeText}`, textStyles.text);
    pdfClient.newLine(STANDARD_NEW_LINE);
  }

  // add any notes included for the observation
  if (labResult.resultNotes?.length) {
    console.log(
      `Drawing observation notes. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
    );
    pdfClient.drawText('Notes:', textStyles.textBold);
    pdfClient.newLine(STANDARD_NEW_LINE);

    labResult.resultNotes?.forEach((note) => {
      const noteLines = note.split('\n');

      noteLines.forEach((noteLine) => {
        if (noteLine === '') pdfClient.newLine(STANDARD_NEW_LINE);
        else {
          // adding a little bit of a left indent for notes
          pdfClient.drawTextSequential(noteLine, textStyles.text, {
            leftBound: 50,
            rightBound: pdfClient.getRightBound(),
          });
          pdfClient.newLine(STANDARD_NEW_LINE);
        }
      });
    });
  }

  let performingLabString: string | undefined;
  if (labResult.performingLabName && labResult.performingLabAddress) {
    performingLabString = `${labResult.performingLabName} ${labResult.performingLabAddress}`;
  } else if (labResult.performingLabName) {
    performingLabString = labResult.performingLabName;
  } else if (labResult.performingLabAddress) {
    performingLabString = labResult.performingLabAddress;
  }

  let labDirector: string | undefined;
  if (labResult.performingLabDirectorFullName && labResult.performingLabPhone) {
    labDirector = `${labResult.performingLabDirectorFullName}, ${labResult.performingLabPhone}`;
  } else if (labResult.performingLabDirectorFullName) {
    labDirector = labResult.performingLabDirectorFullName;
  } else if (labResult.performingLabPhone) {
    labDirector = labResult.performingLabPhone;
  }

  console.log(
    `Drawing performing lab details. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
  );
  if (performingLabString) {
    pdfClient.newLine(6);
    pdfClient.drawText(`PERFORMING SITE: ${performingLabString}`, { ...textStyles.text, fontSize: 10 });
  }
  if (labDirector) {
    pdfClient.newLine(STANDARD_NEW_LINE);
    pdfClient.drawText(`LAB DIRECTOR: ${labDirector}`, { ...textStyles.text, fontSize: 10 });
  }
  pdfClient.newLine(STANDARD_NEW_LINE);
};

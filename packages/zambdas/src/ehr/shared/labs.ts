import Oystehr, { BatchInputGetRequest, SearchParam } from '@oystehr/sdk';
import {
  Account,
  ActivityDefinition,
  Appointment,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  DiagnosticReportLabDetailPageDTO,
  DynamicAOEInput,
  EncounterExternalLabResult,
  EncounterInHouseLabResult,
  EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE,
  externalLabOrderIsManual,
  ExternalLabOrderResult,
  ExternalLabOrderResultConfig,
  getOrderNumber,
  getPresignedURL,
  getTimezone,
  IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG,
  IN_HOUSE_TEST_CODE_SYSTEM,
  InHouseLabResult,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  LabelPdf,
  LabOrderPDF,
  LabOrderResultDetails,
  LabResultPDF,
  LabType,
  nameLabTest,
  OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
} from 'utils';
import { parseLabOrderStatusWithSpecificTask } from '../get-lab-orders/helpers';

export type LabOrderResources = {
  serviceRequest: ServiceRequest;
  patient: Patient;
  practitioner: Practitioner;
  preSubmissionTask: Task;
  labOrganization: Organization;
  encounter: Encounter;
  diagnosticReports: DiagnosticReport[]; // only present if results have come in
  observations: Observation[]; // only present if results have come in
  specimens: Specimen[]; // not always required (psc)
  questionnaireResponse?: QuestionnaireResponse; // not always required (psc)
  schedule?: Schedule;
};

type DrLabResultResources = {
  patient: Patient;
  labOrganization: Organization;
  diagnosticReport: DiagnosticReport;
  observations: Observation[];
};

const makeSearchParamsBasedOnDiagnosticReport = (diagnosticReportID: string): SearchParam[] => {
  return [
    {
      name: '_id',
      value: diagnosticReportID,
    },
    {
      name: '_include',
      value: 'DiagnosticReport:subject', // patient
    },
    {
      name: '_include',
      value: 'DiagnosticReport:performer', // lab org
    },
    {
      name: '_include:iterate',
      value: 'DiagnosticReport:result', // observations
    },
  ];
};

export async function getExternalLabOrderResourcesViaDiagnosticReport(
  oystehr: Oystehr,
  diagnosticReportID: string
): Promise<DrLabResultResources> {
  const searchParams = makeSearchParamsBasedOnDiagnosticReport(diagnosticReportID);
  const resourceSearch = (
    await oystehr.fhir.search<Patient | Organization | DiagnosticReport | Observation>({
      resourceType: 'DiagnosticReport',
      params: searchParams,
    })
  )?.unbundle();

  const patients: Patient[] = [];
  const organizations: Organization[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const observations: Observation[] = [];

  resourceSearch.forEach((resource) => {
    if (resource.resourceType === 'Patient') patients.push(resource);
    if (resource.resourceType === 'Organization') organizations.push(resource);
    if (resource.resourceType === 'Observation') observations.push(resource);
    if (resource.resourceType === 'DiagnosticReport') {
      const isCorrectCategory = diagnosticReportIncludesCategory(
        resource,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code
      );
      if (isCorrectCategory) diagnosticReports.push(resource);
    }
  });

  if (patients?.length !== 1) throw new Error('patient is not found');
  if (organizations?.length !== 1) throw new Error('performing lab Org not found');
  if (diagnosticReports?.length !== 1) throw new Error('diagnosticReport is not found');

  const patient = patients[0];
  const labOrganization = organizations[0];
  const diagnosticReport = diagnosticReports[0];

  return {
    patient,
    labOrganization,
    diagnosticReport,
    observations,
  };
}

const makeSearchParamsBasedOnServiceRequest = (serviceRequestID: string): SearchParam[] => {
  return [
    {
      name: '_id',
      value: serviceRequestID,
    },
    {
      name: '_revinclude',
      value: 'Task:based-on',
    },
    {
      name: '_include',
      value: 'ServiceRequest:subject',
    },
    {
      name: '_revinclude',
      value: 'QuestionnaireResponse:based-on',
    },
    {
      name: '_include',
      value: 'ServiceRequest:requester',
    },
    {
      name: '_include',
      value: 'ServiceRequest:performer',
    },
    {
      name: '_include',
      value: 'ServiceRequest:encounter',
    },
    {
      name: '_revinclude',
      value: 'DiagnosticReport:based-on',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:appointment',
    },
    {
      name: '_include:iterate',
      value: 'Appointment:slot',
    },
    {
      name: '_include:iterate',
      value: 'Slot:schedule',
    },
    {
      name: '_include:iterate',
      value: 'DiagnosticReport:result',
    },
    {
      name: '_include',
      value: 'ServiceRequest:specimen',
    },
  ];
};

export async function getExternalLabOrderResourcesViaServiceRequest(
  oystehr: Oystehr,
  serviceRequestID: string
): Promise<LabOrderResources> {
  const searchParams = makeSearchParamsBasedOnServiceRequest(serviceRequestID);
  const resourceSearch = (
    await oystehr.fhir.search<
      | ServiceRequest
      | QuestionnaireResponse
      | Patient
      | Practitioner
      | Task
      | Organization
      | DiagnosticReport
      | Appointment
      | Schedule
      | Encounter
      | Observation
      | Specimen
    >({
      resourceType: 'ServiceRequest',
      params: searchParams,
    })
  )?.unbundle();

  const serviceRequests: ServiceRequest[] = [];
  const patients: Patient[] = [];
  const practitioners: Practitioner[] = [];
  const tasks: Task[] = [];
  const organizations: Organization[] = [];
  const encounters: Encounter[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const observations: Observation[] = [];
  const specimens: Specimen[] = [];
  const questionnaireResponses: QuestionnaireResponse[] = [];
  const schedules: Schedule[] = [];

  resourceSearch.forEach((resource) => {
    if (resource.resourceType === 'ServiceRequest') serviceRequests.push(resource);
    if (resource.resourceType === 'Patient') patients.push(resource);
    if (resource.resourceType === 'Practitioner') practitioners.push(resource);
    if (resource.resourceType === 'Organization') organizations.push(resource);
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    if (resource.resourceType === 'Observation') observations.push(resource);
    if (resource.resourceType === 'Specimen') specimens.push(resource);
    if (resource.resourceType === 'QuestionnaireResponse') questionnaireResponses.push(resource);
    if (resource.resourceType === 'Schedule') schedules.push(resource);
    if (resource.resourceType === 'Task') {
      const taskIsPst = !!resource.code?.coding?.find(
        (c) => c.system === LAB_ORDER_TASK.system && c.code === LAB_ORDER_TASK.code.preSubmission
      );
      if (taskIsPst) tasks.push(resource);
    }
    if (resource.resourceType === 'DiagnosticReport') {
      const isCorrectCategory = diagnosticReportIncludesCategory(
        resource,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code
      );
      if (isCorrectCategory) diagnosticReports.push(resource);
    }
  });

  if (serviceRequests?.length !== 1) throw new Error('service request is not found');
  if (patients?.length !== 1) throw new Error('patient is not found');
  if (practitioners?.length !== 1) throw new Error('practitioner is not found');
  if (tasks?.length !== 1) throw new Error('task is not found');
  if (organizations?.length !== 1) throw new Error('performing lab Org not found');
  if (encounters?.length !== 1) throw new Error('encounter is not found');

  const serviceRequest = serviceRequests[0];
  const patient = patients[0];
  const practitioner = practitioners[0];
  const preSubmissionTask = tasks[0];
  const labOrganization = organizations[0];
  const encounter = encounters[0];
  const questionnaireResponse = questionnaireResponses?.[0];
  const schedule = schedules?.[0];

  return {
    serviceRequest,
    patient,
    practitioner,
    preSubmissionTask,
    labOrganization,
    encounter,
    diagnosticReports,
    observations,
    specimens,
    questionnaireResponse,
    schedule,
  };
}

export const getPrimaryInsurance = (account: Account, coverages: Coverage[]): Coverage | undefined => {
  if (coverages.length === 0) return;
  const coverageMap: { [key: string]: Coverage } = {};
  coverages.forEach((c) => (coverageMap[`Coverage/${c.id}`] = c));

  const includedCoverages = account.coverage?.filter((c) => {
    const coverageRef = c.coverage.reference;
    if (coverageRef) return Object.keys(coverageMap).includes(coverageRef);
    return;
  });

  if (includedCoverages?.length) {
    includedCoverages.sort((a, b) => {
      const priorityA = a.priority ?? -Infinity;
      const priorityB = b.priority ?? -Infinity;
      return priorityA - priorityB;
    });
    const highestPriorityCoverageRef = includedCoverages[0].coverage.reference;
    if (highestPriorityCoverageRef) return coverageMap[highestPriorityCoverageRef];
  } else {
    console.log('no coverages were included on account.coverage, grabbing primary ins from list of patient coverages');
    coverages.sort((a, b) => {
      const orderA = a.order ?? -Infinity;
      const orderB = b.order ?? -Infinity;
      return orderA - orderB;
    });
    return coverages[0];
  }
  return;
};

export const makeEncounterLabResults = async (
  resources: FhirResource[],
  m2mToken: string
): Promise<{
  externalLabResultConfig: EncounterExternalLabResult;
  inHouseLabResultConfig: EncounterInHouseLabResult;
}> => {
  const documentReferences: DocumentReference[] = [];
  const activeExternalLabServiceRequests: ServiceRequest[] = [];
  const activeInHouseLabServiceRequests: ServiceRequest[] = [];
  const serviceRequestMap: Record<string, { resource: ServiceRequest; type: LabType }> = {};
  const diagnosticReportMap: Record<string, DiagnosticReport> = {};

  resources.forEach((resource) => {
    if (resource.resourceType === 'DocumentReference') {
      const isLabsDocRef = !!resource.type?.coding?.find((c) => c.code === LAB_RESULT_DOC_REF_CODING_CODE.code);
      if (isLabsDocRef) documentReferences.push(resource as DocumentReference);
    }
    if (resource.resourceType === 'ServiceRequest') {
      const isExternalLabServiceRequest = !!resource.code?.coding?.find((c) => c.system === OYSTEHR_LAB_OI_CODE_SYSTEM);
      const isInHouseLabServiceRequest = !!resource.code?.coding?.find((c) => c.system === IN_HOUSE_TEST_CODE_SYSTEM);
      if (isExternalLabServiceRequest || isInHouseLabServiceRequest) {
        serviceRequestMap[`ServiceRequest/${resource.id}`] = {
          resource: resource as ServiceRequest,
          type: isExternalLabServiceRequest ? LabType.external : LabType.inHouse,
        };
        if (resource.status === 'active') {
          if (isExternalLabServiceRequest) {
            const isManual = externalLabOrderIsManual(resource);
            // theres no guarantee that will we get electronic results back for manual labs so we can't validate
            if (!isManual) activeExternalLabServiceRequests.push(resource);
          }
          if (isInHouseLabServiceRequest) activeInHouseLabServiceRequests.push(resource);
        }
      }
    }
    if (resource.resourceType === 'DiagnosticReport') {
      const isExternalLabsDR = diagnosticReportIncludesCategory(
        resource,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code
      );
      const isInHouseLabsDR = diagnosticReportIncludesCategory(
        resource,
        IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG.system,
        IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG.code
      );
      if (isExternalLabsDR || isInHouseLabsDR) {
        diagnosticReportMap[`DiagnosticReport/${resource.id}`] = resource as DiagnosticReport;
      }
    }
  });

  const externalLabOrderResults: ExternalLabOrderResult[] = [];
  const inHouseLabOrderResults: InHouseLabResult[] = [];
  const reflexOrderResults: ExternalLabOrderResultConfig[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportRef = docRef.context?.related?.find(
      (related) => related.reference?.startsWith('DiagnosticReport')
    )?.reference;
    if (diagnosticReportRef) {
      const relatedDR: DiagnosticReport | undefined = diagnosticReportMap[diagnosticReportRef];
      const serviceRequestRef = relatedDR?.basedOn?.find((based) => based.reference?.startsWith('ServiceRequest'))
        ?.reference;
      if (serviceRequestRef) {
        const relatedSRDetail = serviceRequestMap[serviceRequestRef];
        if (!relatedSRDetail) continue;
        if (relatedSRDetail.type === LabType.external) {
          const sr = relatedSRDetail.resource;
          const isReflex = diagnosticReportIsReflex(relatedDR);
          const orderNumber = getOrderNumber(sr);
          const activityDef = sr.contained?.find(
            (resource) => resource.resourceType === 'ActivityDefinition'
          ) as ActivityDefinition;
          const testName = activityDef?.code?.coding?.find((c) => c.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display;
          const labName = activityDef?.publisher;
          let formattedName = nameLabTest(testName, labName, false);
          if (isReflex) {
            const reflexTestName = relatedDR?.code.coding?.[0].display || 'Name missing';
            formattedName = nameLabTest(reflexTestName, labName, true);
          }

          const { externalResultConfigs } = await getLabOrderResultPDFConfig(docRef, formattedName, m2mToken, {
            type: LabType.external,
            orderNumber,
          });
          if (isReflex) {
            reflexOrderResults.push(...externalResultConfigs);
          } else {
            externalLabOrderResults.push(...externalResultConfigs);
          }
        } else if (relatedSRDetail.type === LabType.inHouse) {
          const sr = relatedSRDetail.resource;
          const testName = sr.code?.text;
          const { inHouseResultConfigs } = await getLabOrderResultPDFConfig(
            docRef,
            testName || 'missing test details',
            m2mToken,
            { type: LabType.inHouse }
          );
          inHouseLabOrderResults.push(...inHouseResultConfigs);
        }
      } else {
        // todo what to do here for unsolicited results
        // maybe we don't need to handle these for mvp
        console.log('no serviceRequestRef for', docRef.id);
      }
    } else {
      // something has gone awry during the document reference creation if there is no diagnostic report linked
      // so this shouldn't happen but if it does we will still surface the report
      console.log('no diagnosticReportRef for', docRef.id);
    }
  }

  // map reflex tests to their original ordered test
  reflexOrderResults.forEach((reflexRes) => {
    const ogOrderResIdx = externalLabOrderResults.findIndex(
      (res) => res?.orderNumber && res.orderNumber === reflexRes.orderNumber
    );
    if (ogOrderResIdx !== -1) {
      const ogOrderRes = externalLabOrderResults[ogOrderResIdx];
      if (!ogOrderRes.reflexResults) {
        ogOrderRes.reflexResults = [reflexRes];
      } else {
        ogOrderRes.reflexResults.push(reflexRes);
      }
    }
  });

  const externalResultsPending = activeExternalLabServiceRequests.length > 0;
  const inHouseResultsPending = activeInHouseLabServiceRequests.length > 0;

  const externalLabResultConfig: EncounterExternalLabResult = {
    resultsPending: externalResultsPending,
    labOrderResults: externalLabOrderResults,
  };

  const inHouseLabResultConfig: EncounterInHouseLabResult = {
    resultsPending: inHouseResultsPending,
    labOrderResults: inHouseLabOrderResults,
  };
  return { externalLabResultConfig, inHouseLabResultConfig };
};

const getLabOrderResultPDFConfig = async (
  docRef: DocumentReference,
  formattedName: string,
  m2mToken: string,
  resultDetails:
    | {
        type: LabType.external;
        orderNumber?: string;
      }
    | {
        type: LabType.inHouse;
        simpleResultValue?: string; // todo not implemented, displaying this is a post mvp feature
      }
): Promise<{ externalResultConfigs: ExternalLabOrderResultConfig[]; inHouseResultConfigs: InHouseLabResult[] }> => {
  const externalResults: ExternalLabOrderResultConfig[] = [];
  const inHouseResults: InHouseLabResult[] = [];
  for (const content of docRef.content) {
    const z3Url = content.attachment.url;
    if (z3Url) {
      const url = await getPresignedURL(z3Url, m2mToken);

      if (!url) {
        console.warn(`Skipped lab result because presigned URL could not be fetched for ${z3Url}`);
        continue;
      }

      if (resultDetails.type === LabType.external) {
        const labResult: ExternalLabOrderResultConfig = {
          name: formattedName,
          url,
          orderNumber: resultDetails?.orderNumber,
        };
        externalResults.push(labResult);
      } else if (resultDetails.type === LabType.inHouse) {
        const labResult: InHouseLabResult = {
          name: formattedName,
          url,
          simpleResultValue: resultDetails?.simpleResultValue,
        };
        inHouseResults.push(labResult);
      }
    }
  }

  return { externalResultConfigs: externalResults, inHouseResultConfigs: inHouseResults };
};

export const configLabRequestsForGetChartData = (encounterId: string): BatchInputGetRequest[] => {
  // DocumentReference.related will contain a reference to the related diagnostic report which is needed to know more about the test
  // namely, if the test is reflex and also lets us grab the related service request which has info on the test & lab name, needed for results display
  const docRefSearch: BatchInputGetRequest = {
    method: 'GET',
    url: `/DocumentReference?status=current&type=${LAB_RESULT_DOC_REF_CODING_CODE.code}&encounter=${encounterId}&_include:iterate=DocumentReference:related&_include:iterate=DiagnosticReport:based-on`,
  };
  // Grabbing active lab service requests separately since they might not have results
  // but we validate against actually signing the progress note if there are any pending
  const activeLabServiceRequestSearch: BatchInputGetRequest = {
    method: 'GET',
    url: `/ServiceRequest?encounter=Encounter/${encounterId}&status=active&code=${OYSTEHR_LAB_OI_CODE_SYSTEM}|,${IN_HOUSE_TEST_CODE_SYSTEM}|`,
  };
  return [docRefSearch, activeLabServiceRequestSearch];
};

const diagnosticReportIncludesCategory = (
  diagnosticReport: DiagnosticReport,
  system: string,
  code: string
): boolean => {
  return !!diagnosticReport.category?.find((cat) => cat?.coding?.find((c) => c.system === system && c.code === code));
};

const getDocRefRelatedId = (
  docRef: DocumentReference,
  relatedResourceType: FhirResource['resourceType']
): string | undefined => {
  const reference = docRef.context?.related?.find((rel) => rel.reference?.startsWith(`${relatedResourceType}/`))
    ?.reference;
  return reference?.split('/')[1];
};

type FetchLabOrderPDFRes = {
  resultPDFs: LabResultPDF[];
  labelPDF: LabelPdf | undefined;
  orderPDF: LabOrderPDF | undefined;
};
export const fetchLabOrderPDFsPresignedUrls = async (
  documentReferences: DocumentReference[],
  m2mToken: string
): Promise<FetchLabOrderPDFRes | undefined> => {
  if (!documentReferences.length) {
    return;
  }
  const pdfPromises: Promise<LabResultPDF | LabelPdf | LabOrderPDF | null>[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportId = getDocRefRelatedId(docRef, 'DiagnosticReport');
    const serviceRequestId = getDocRefRelatedId(docRef, 'ServiceRequest');
    const isLabOrderDoc = docRef.type?.coding?.find(
      (code) => code.system === LAB_ORDER_DOC_REF_CODING_CODE.system && code.code === LAB_ORDER_DOC_REF_CODING_CODE.code
    );
    const isLabelDoc = docRef.type?.coding?.find(
      (code) =>
        code.system === EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.system &&
        code.code === EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code
    );
    const docRefId = docRef.id;

    for (const content of docRef.content) {
      const z3Url = content.attachment?.url;
      if (z3Url) {
        pdfPromises.push(
          getPresignedURL(z3Url, m2mToken)
            .then((presignedURL) => {
              if (diagnosticReportId) {
                return { presignedURL, diagnosticReportId } as LabResultPDF;
              } else if (serviceRequestId && isLabOrderDoc) {
                return { presignedURL, serviceRequestId, docRefId } as LabOrderPDF;
              } else if (serviceRequestId && isLabelDoc) {
                return { presignedURL, documentReference: docRef } as LabelPdf;
              }
              return null;
            })
            .catch((error) => {
              console.error(`Failed to get presigned URL for document ${docRef.id}:`, error);
              return null;
            })
        );
      }
    }
  }

  const pdfs = await Promise.allSettled(pdfPromises);

  const { resultPDFs, labelPDF, orderPDF } = pdfs
    .filter(
      (result): result is PromiseFulfilledResult<LabResultPDF | LabelPdf | LabOrderPDF> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .reduce(
      (acc: FetchLabOrderPDFRes, result) => {
        if ('diagnosticReportId' in result.value) {
          acc.resultPDFs.push(result.value);
        } else if ('serviceRequestId' in result.value) {
          acc.orderPDF = result.value;
        } else if ('documentReference' in result.value) {
          acc.labelPDF = result.value;
        }
        return acc;
      },
      { resultPDFs: [], labelPDF: undefined, orderPDF: undefined }
    );

  return { resultPDFs, labelPDF, orderPDF };
};

export const parseAppointmentIdForServiceRequest = (
  serviceRequest: ServiceRequest,
  encounters: Encounter[]
): string | undefined => {
  console.log('getting appointment id for service request', serviceRequest.id);
  const encounterId = serviceRequest.encounter?.reference?.split('/').pop();
  const NOT_FOUND = undefined;

  if (!encounterId) {
    return NOT_FOUND;
  }

  const relatedEncounter = encounters.find((encounter) => encounter.id === encounterId);

  if (relatedEncounter?.appointment?.length) {
    return relatedEncounter.appointment[0]?.reference?.split('/').pop() || NOT_FOUND;
  }

  return NOT_FOUND;
};

export const parseTimezoneForAppointmentSchedule = (
  appointment: Appointment | undefined,
  appointmentScheduleMap: Record<string, Schedule>
): string | undefined => {
  if (!appointment || !appointment.id) return;
  const schedule = appointmentScheduleMap[appointment.id];
  let timezone;
  if (schedule) {
    timezone = getTimezone(schedule);
  }
  return timezone;
};

export const documentReferenceIsLabs = (docRef: DocumentReference): boolean => {
  return !!docRef.type?.coding?.some(
    (c) => c.system === LAB_RESULT_DOC_REF_CODING_CODE.system && c.code === LAB_RESULT_DOC_REF_CODING_CODE.code
  );
};

export const diagnosticReportIsReflex = (dr: DiagnosticReport): boolean => {
  return !!dr?.meta?.tag?.find(
    (t) => t.system === LAB_DR_TYPE_TAG.system && t.display === LAB_DR_TYPE_TAG.display.reflex
  );
};

export const diagnosticReportIsUnsolicited = (dr: DiagnosticReport): boolean => {
  return !!dr?.meta?.tag?.find(
    (t) => t.system === LAB_DR_TYPE_TAG.system && t.display === LAB_DR_TYPE_TAG.display.unsolicited
  );
};

export interface AOEDisplayForOrderForm {
  question: string;
  answer: any[];
}
export const populateQuestionnaireResponseItems = async (
  questionnaireResponse: QuestionnaireResponse,
  data: DynamicAOEInput,
  m2mToken: string
): Promise<{
  questionnaireResponseItems: QuestionnaireResponseItem[];
  questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[]; // we may not need this anymore
}> => {
  const questionnaireUrl = questionnaireResponse.questionnaire;

  if (!questionnaireUrl) {
    throw new Error('questionnaire is not found');
  }

  console.log(questionnaireUrl);

  const questionnaireRequest = await fetch(questionnaireUrl, {
    headers: {
      Authorization: `Bearer ${m2mToken}`,
    },
  });

  const questionnaire: Questionnaire = await questionnaireRequest.json();

  if (!questionnaire.item) {
    throw new Error('questionnaire item is not found');
  }

  const questionsAndAnswersForFormDisplay: AOEDisplayForOrderForm[] = [];

  const questionnaireResponseItems: QuestionnaireResponseItem[] = Object.keys(data).map((questionResponse) => {
    const question = questionnaire.item?.find((item) => item.linkId === questionResponse);
    if (!question) {
      throw new Error('question is not found');
    }

    let answer: QuestionnaireResponseItemAnswer[] | undefined = undefined;
    let answerForDisplay = data[questionResponse] !== undefined ? data[questionResponse] : 'UNKNOWN';

    const multiSelect = question.extension?.find(
      (currentExtension) =>
        currentExtension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type' &&
        currentExtension.valueString === 'multi-select list'
    );
    if (question.type === 'text' || (question.type === 'choice' && !multiSelect)) {
      answer = [
        {
          valueString: data[questionResponse],
        },
      ];
    }
    if (multiSelect) {
      answer = data[questionResponse].map((item: string) => ({ valueString: item }));
      answerForDisplay = data[questionResponse].join(', ');
    }

    if (question.type === 'boolean') {
      answer = [
        {
          valueBoolean: data[questionResponse],
        },
      ];
      answerForDisplay = answerForDisplay === true ? 'Yes' : answerForDisplay === false ? 'No' : answerForDisplay;
    }

    if (question.type === 'date') {
      answer = [
        {
          valueDate: data[questionResponse],
        },
      ];
    }

    if (question.type === 'decimal') {
      answer = [
        {
          valueDecimal: data[questionResponse],
        },
      ];
    }

    if (question.type === 'integer') {
      answer = [
        {
          valueInteger: data[questionResponse],
        },
      ];
    }

    if (answer == undefined) {
      throw new Error('answer is undefined');
    }

    if (answerForDisplay !== undefined && answerForDisplay !== '')
      questionsAndAnswersForFormDisplay.push({
        question: question.text || 'UNKNOWN',
        answer: answerForDisplay,
      });

    return {
      linkId: questionResponse,
      answer: answer,
    };
  });

  return { questionnaireResponseItems, questionsAndAnswersForFormDisplay };
};

// diagnostic report driven helper functions
export type AllResources = {
  diagnosticReport: DiagnosticReport;
  readyTasks: Task[];
  completedTasks: Task[];
  patient?: Patient;
  labOrg?: Organization;
  resultPdfDocumentReference?: DocumentReference;
};
export type ResourcesByDr = {
  [diagnosticReportId: string]: AllResources;
};

export const groupResourcesByDr = (resources: FhirResource[]): ResourcesByDr => {
  const drMap: ResourcesByDr = {};
  const readyTasks: Task[] = [];
  const completedTasks: Task[] = [];
  const patients: Patient[] = [];
  const patientRefToRelatedDrMap: Record<string, string[]> = {};
  const orgRefToRelatedDrMap: Record<string, string[]> = {};
  const labOrganizations: Organization[] = [];
  const currentResultPDFDocRefs: DocumentReference[] = [];
  resources.forEach((resource) => {
    if (resource.resourceType === 'DiagnosticReport') {
      if (resource.id) {
        drMap[resource.id] = { diagnosticReport: resource, readyTasks: [], completedTasks: [] };
        const isPatientSubject = resource.subject?.reference?.startsWith('Patient/');
        if (isPatientSubject) {
          const patientRef = resource.subject?.reference;
          if (patientRef) {
            if (patientRefToRelatedDrMap[patientRef]) {
              patientRefToRelatedDrMap[patientRef].push(resource.id);
            } else {
              patientRefToRelatedDrMap[patientRef] = [resource.id];
            }
          }
        }
        const orgPerformer = resource.performer?.find((p) => p.reference?.startsWith('Organization/'))?.reference;
        if (orgPerformer) {
          if (orgRefToRelatedDrMap[orgPerformer]) {
            orgRefToRelatedDrMap[orgPerformer].push(resource.id);
          } else {
            orgRefToRelatedDrMap[orgPerformer] = [resource.id];
          }
        }
      }
    }
    if (resource.resourceType === 'Organization') {
      const isLabOrg = !!resource.identifier?.some((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM);
      if (isLabOrg) labOrganizations.push(resource);
    }
    if (resource.resourceType === 'Task') {
      if (resource.status === 'ready') {
        readyTasks.push(resource);
      } else if (resource.status === 'completed') {
        completedTasks.push(resource);
      }
    }
    if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
      const isResultPdfDocRef = documentReferenceIsLabs(resource);
      if (isResultPdfDocRef) {
        currentResultPDFDocRefs.push(resource);
      }
    }
    if (resource.resourceType === 'Patient') patients.push(resource);
  });
  readyTasks.forEach((task) => {
    const relatedDrId = task.basedOn
      ?.find((ref) => ref.reference?.startsWith('DiagnosticReport'))
      ?.reference?.replace('DiagnosticReport/', '');

    if (relatedDrId) {
      drMap[relatedDrId].readyTasks.push(task);
    }
  });
  completedTasks.forEach((task) => {
    const relatedDrId = task.basedOn
      ?.find((ref) => ref.reference?.startsWith('DiagnosticReport'))
      ?.reference?.replace('DiagnosticReport/', '');

    if (relatedDrId) {
      drMap[relatedDrId].completedTasks.push(task);
    }
  });
  patients.forEach((patient) => {
    const patientRef = `Patient/${patient.id}`;
    const drIds = patientRefToRelatedDrMap[patientRef];
    drIds.forEach((drId) => {
      drMap[drId].patient = patient;
    });
  });
  labOrganizations.forEach((labOrg) => {
    const labOrgRef = `Organization/${labOrg.id}`;
    const drIds = orgRefToRelatedDrMap[labOrgRef];
    drIds.forEach((drId) => {
      drMap[drId].labOrg = labOrg;
    });
  });
  currentResultPDFDocRefs.forEach((docRef) => {
    const relatedDrId = docRef.context?.related
      ?.find((ref) => ref.reference?.startsWith('DiagnosticReport/'))
      ?.reference?.replace('DiagnosticReport/', '');
    if (relatedDrId) {
      drMap[relatedDrId].resultPdfDocumentReference = docRef;
    }
  });
  return drMap;
};

export const formatResourcesIntoDiagnosticReportLabDTO = async (
  resources: AllResources,
  token: string
): Promise<DiagnosticReportLabDetailPageDTO | undefined> => {
  const { diagnosticReport, readyTasks, completedTasks, labOrg, resultPdfDocumentReference } = resources;
  const matchTask = [...readyTasks, ...completedTasks].find(
    (task) =>
      task.code?.coding?.some(
        (c) => c.system === LAB_ORDER_TASK.system && c.code === LAB_ORDER_TASK.code.matchUnsolicitedResult
      )
  );
  const reviewTask = [...readyTasks, ...completedTasks].find(
    (task) =>
      task.code?.coding?.some(
        (c) =>
          c.system === LAB_ORDER_TASK.system &&
          (c.code === LAB_ORDER_TASK.code.reviewFinalResult ||
            c.code === LAB_ORDER_TASK.code.reviewPreliminaryResult ||
            c.code === LAB_ORDER_TASK.code.reviewCorrectedResult ||
            c.code === LAB_ORDER_TASK.code.reviewCancelledResult)
      )
  );

  // console.log('check matchTask', JSON.stringify(matchTask));
  // console.log('check reviewTask', JSON.stringify(reviewTask));
  const task = reviewTask || matchTask;

  if (!task) {
    console.log(`No tasks found for diagnostic report: ${diagnosticReport.id}`);
    return;
  } else {
    console.log('task id being passed to parseLabOrderStatusWithSpecificTask:', task.id);
  }

  // const history: LabOrderHistoryRow[] = [parseTaskReceivedAndReviewedAndCorrectedHistory(task, )]

  console.log('forming result detail');
  const detail = await getResultDetailsBasedOnDr(diagnosticReport, task, resultPdfDocumentReference, token);

  console.log('formatting dto');
  const dto: DiagnosticReportLabDetailPageDTO = {
    testItem: getTestNameOrCodeFromDr(diagnosticReport),
    fillerLab: labOrg?.name || '',
    orderStatus: parseLabOrderStatusWithSpecificTask(diagnosticReport, task, undefined, null),
    isPSC: false,
    lastResultReceivedDate: diagnosticReport.effectiveDateTime || '',
    accessionNumbers: [parseAccessionNumberFromDr(diagnosticReport)],
    history: [], // todo post mvp
    resultsDetails: [detail],
    questionnaire: [], // will always be empty but is easier for the front end to consume an empty array
    samples: [], // will always be empty but is easier for the front end to consume an empty array
  };

  return dto;
};

const getResultDetailsBasedOnDr = async (
  diagnosticReport: DiagnosticReport,
  task: Task,
  documentReference: DocumentReference | undefined,
  token: string
): Promise<LabOrderResultDetails> => {
  const resultType: LabOrderResultDetails['resultType'] = (() => {
    switch (diagnosticReport.status) {
      case 'final':
        return 'final';
      case 'preliminary':
        return 'preliminary';
      case 'cancelled':
        return 'cancelled';
      default:
        throw Error(`Error parsing result type for diagnostic report: ${diagnosticReport.id}`);
    }
  })();

  const resultPdfUrl = documentReference ? await getResultPDFUrlBasedOnDr(documentReference, token) : '';

  const isReflex = diagnosticReportIsReflex(diagnosticReport);
  const testType = isReflex ? 'reflex' : 'unsolicited';

  const resultDetail: LabOrderResultDetails = {
    testItem: getTestNameOrCodeFromDr(diagnosticReport),
    testType,
    resultType,
    labStatus: parseLabOrderStatusWithSpecificTask(diagnosticReport, task, undefined, null),
    receivedDate: diagnosticReport.effectiveDateTime || '',
    reviewedDate: '', // todo future, this only gets passed for prelim
    resultPdfUrl,
    diagnosticReportId: diagnosticReport.id || '',
    taskId: task.id || '',
  };

  return resultDetail;
};

const getResultPDFUrlBasedOnDr = async (docRef: DocumentReference, m2mToken: string): Promise<string> => {
  const pdfs = await fetchLabOrderPDFsPresignedUrls([docRef], m2mToken);
  const resultPDFs = pdfs?.resultPDFs;
  if (resultPDFs?.length !== 1) {
    console.log('Unexpected number of resultPDFs returned: ', resultPDFs?.length);
    return '';
  }
  const pdfUrl = resultPDFs[0].presignedURL;
  return pdfUrl;
};

export const parseAccessionNumberFromDr = (result: DiagnosticReport): string => {
  const NOT_FOUND = '';

  if (result.identifier) {
    const accessionIdentifier = result.identifier.find(
      (identifier) => identifier.type?.coding?.some((coding) => coding.code === 'FILL') && identifier.use === 'usual'
    );

    if (accessionIdentifier?.value) {
      return accessionIdentifier.value;
    }
  }

  return NOT_FOUND;
};

export const getTestNameFromDr = (dr: DiagnosticReport): string | undefined => {
  const testName =
    dr.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display ||
    dr.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.display ||
    dr.code.coding?.find((temp) => temp.system === '(HL7_V2)')?.display;
  return testName;
};

export const getTestItemCodeFromDr = (dr: DiagnosticReport): string | undefined => {
  const testName =
    dr.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
    dr.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code;
  return testName;
};

export const getTestNameOrCodeFromDr = (dr: DiagnosticReport): string => {
  const testName = getTestNameFromDr(dr);
  const testItemCode = getTestItemCodeFromDr(dr);
  const testDescription = testName || testItemCode || 'missing test name';
  return testDescription;
};

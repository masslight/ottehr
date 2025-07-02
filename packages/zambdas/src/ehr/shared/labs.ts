import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
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
  QuestionnaireResponse,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  EncounterExternalLabResult,
  EncounterInHouseLabResult,
  ExternalLabOrderResult,
  ExternalLabOrderResultConfig,
  getPresignedURL,
  IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG,
  IN_HOUSE_TEST_CODE_SYSTEM,
  InHouseLabResult,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_RESULT_DOC_REF_CODING_CODE,
  LabOrderPDF,
  LabResultPDF,
  LabType,
  nameLabTest,
  OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
} from 'utils';

export type LabOrderResources = {
  serviceRequest: ServiceRequest;
  patient: Patient;
  questionnaireResponse?: QuestionnaireResponse;
  practitioner: Practitioner;
  task: Task;
  organization: Organization | undefined;
  diagnosticReports: DiagnosticReport[];
  schedule?: Schedule;
  appointment: Appointment;
  encounter: Encounter;
  observations: Observation[];
  specimens: Specimen[];
};

export async function getExternalLabOrderResources(
  oystehr: Oystehr,
  serviceRequestID: string
): Promise<LabOrderResources> {
  const serviceRequestTemp = (
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
      params: [
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
      ],
    })
  )?.unbundle();

  const serviceRequestsTemp: ServiceRequest[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is ServiceRequest => resourceTemp.resourceType === 'ServiceRequest'
  );

  const patientsTemp: Patient[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Patient => resourceTemp.resourceType === 'Patient'
  );

  const practitionersTemp: Practitioner[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Practitioner => resourceTemp.resourceType === 'Practitioner'
  );

  const questionnaireResponsesTemp: QuestionnaireResponse[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is QuestionnaireResponse => resourceTemp.resourceType === 'QuestionnaireResponse'
  );

  const tasksTemp: Task[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Task => resourceTemp.resourceType === 'Task'
  );

  const orgsTemp: Organization[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Organization => resourceTemp.resourceType === 'Organization'
  );

  const diagnosticReportsTemp: DiagnosticReport[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is DiagnosticReport =>
      resourceTemp.resourceType === 'DiagnosticReport' &&
      diagnosticReportIncludesCategory(
        resourceTemp,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system,
        OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code
      )
  );

  const schedulesTemp: Schedule[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Schedule => resourceTemp.resourceType === 'Schedule'
  );

  const appointmentsTemp: Appointment[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Appointment => resourceTemp.resourceType === 'Appointment'
  );

  const encountersTemp: Encounter[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Encounter => resourceTemp.resourceType === 'Encounter'
  );

  const observationsTemp: Observation[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp): resourceTemp is Observation => resourceTemp.resourceType === 'Observation'
  );

  const specimens = serviceRequestTemp?.filter(
    (resource): resource is Specimen => resource.resourceType === 'Specimen'
  );

  if (serviceRequestsTemp?.length !== 1) {
    throw new Error('service request is not found');
  }

  if (patientsTemp?.length !== 1) {
    throw new Error('patient is not found');
  }

  if (practitionersTemp?.length !== 1) {
    throw new Error('practitioner is not found');
  }

  if (tasksTemp?.length !== 1) {
    throw new Error('task is not found');
  }

  if (orgsTemp?.length !== 1) {
    throw new Error('performing lab Org not found');
  }

  if (appointmentsTemp?.length !== 1) {
    throw new Error('appointment is not found');
  }

  if (encountersTemp?.length !== 1) {
    throw new Error('encounter is not found');
  }

  const serviceRequest = serviceRequestsTemp?.[0];
  const patient = patientsTemp?.[0];
  const practitioner = practitionersTemp?.[0];
  const questionnaireResponse = questionnaireResponsesTemp?.[0];
  const task = tasksTemp?.[0];
  const organization = orgsTemp?.[0];
  const diagnosticReports = diagnosticReportsTemp;
  const schedule = schedulesTemp?.[0];
  const appointment = appointmentsTemp?.[0];
  const encounter = encountersTemp?.[0];
  const observations = observationsTemp;

  return {
    serviceRequest: serviceRequest,
    patient,
    practitioner,
    questionnaireResponse: questionnaireResponse,
    task,
    organization,
    diagnosticReports,
    schedule,
    appointment,
    encounter,
    observations,
    specimens,
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
          if (isExternalLabServiceRequest) activeExternalLabServiceRequests.push(resource);
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
        if (relatedSRDetail.type === LabType.external) {
          const sr = relatedSRDetail.resource;
          const isReflex = relatedDR?.meta?.tag?.find(
            (t) => t.system === LAB_DR_TYPE_TAG.system && t.display === LAB_DR_TYPE_TAG.display.reflex
          );
          const orderNumber = sr.identifier?.find((id) => id.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value;
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

type FetchLabOrderPDFRes = { resultPDFs: LabResultPDF[]; orderPDF: LabOrderPDF | undefined };
export const fetchLabOrderPDFsPresignedUrls = async (
  documentReferences: DocumentReference[],
  m2mToken: string
): Promise<FetchLabOrderPDFRes | undefined> => {
  if (!documentReferences.length) {
    return;
  }
  const pdfPromises: Promise<LabResultPDF | LabOrderPDF | null>[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportId = getDocRefRelatedId(docRef, 'DiagnosticReport');
    const serviceRequestId = getDocRefRelatedId(docRef, 'ServiceRequest');
    const isLabOrderDoc = docRef.type?.coding?.find(
      (code) => code.system === LAB_ORDER_DOC_REF_CODING_CODE.system && code.code === LAB_ORDER_DOC_REF_CODING_CODE.code
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

  const { resultPDFs, orderPDF } = pdfs
    .filter(
      (result): result is PromiseFulfilledResult<LabResultPDF | LabOrderPDF> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .reduce(
      (acc: FetchLabOrderPDFRes, result) => {
        if ('diagnosticReportId' in result.value) {
          acc.resultPDFs.push(result.value);
        } else if ('serviceRequestId' in result.value) {
          acc.orderPDF = result.value;
        }
        return acc;
      },
      { resultPDFs: [], orderPDF: undefined }
    );

  return { resultPDFs, orderPDF };
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

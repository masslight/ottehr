import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import {
  ServiceRequest,
  QuestionnaireResponse,
  Practitioner,
  Task,
  Patient,
  Account,
  Coverage,
  Organization,
  FhirResource,
  DocumentReference,
  DiagnosticReport,
} from 'fhir/r4b';
import {
  EncounterLabResult,
  LabOrderResult,
  LabOrderResultPDFConfig,
  LAB_ORDER_PLACER_ID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  getPresignedURL,
} from 'utils';

export type LabOrderResources = {
  serviceRequest: ServiceRequest;
  patient: Patient;
  questionnaireResponse: QuestionnaireResponse;
  practitioner: Practitioner;
  task: Task;
  organization: Organization;
};

export async function getLabOrderResources(oystehr: Oystehr, serviceRequestID: string): Promise<LabOrderResources> {
  const serviceRequestTemp = (
    await oystehr.fhir.search<ServiceRequest | QuestionnaireResponse | Patient | Practitioner | Task | Organization>({
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

  if (serviceRequestsTemp?.length !== 1) {
    throw new Error('service request is not found');
  }

  if (patientsTemp?.length !== 1) {
    throw new Error('patient is not found');
  }

  if (practitionersTemp?.length !== 1) {
    throw new Error('practitioner is not found');
  }

  if (questionnaireResponsesTemp?.length !== 1) {
    throw new Error('questionnaire response is not found');
  }

  if (tasksTemp?.length !== 1) {
    throw new Error('task is not found');
  }

  if (orgsTemp?.length !== 1) {
    throw new Error('performing lab Org not found');
  }

  const serviceRequest = serviceRequestsTemp?.[0];
  const patient = patientsTemp?.[0];
  const practitioner = practitionersTemp?.[0];
  const questionnaireResponse = questionnaireResponsesTemp?.[0];
  const task = tasksTemp?.[0];
  const organization = orgsTemp?.[0];

  return {
    serviceRequest: serviceRequest,
    patient,
    practitioner,
    questionnaireResponse: questionnaireResponse,
    task,
    organization,
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

export const makeEncounterLabResult = async (
  resources: FhirResource[],
  m2mtoken: string
): Promise<EncounterLabResult> => {
  const documentReferences: DocumentReference[] = [];
  const activeServiceRequests: ServiceRequest[] = [];
  const serviceRequestMap: Record<string, ServiceRequest> = {};
  const diagnosticReportMap: Record<string, DiagnosticReport> = {};

  resources.forEach((resource) => {
    if (resource.resourceType === 'DocumentReference') documentReferences.push(resource as DocumentReference);
    if (resource.resourceType === 'ServiceRequest') {
      serviceRequestMap[`ServiceRequest/${resource.id}`] = resource as ServiceRequest;
      if (resource.status === 'active') activeServiceRequests.push(resource);
    }
    if (resource.resourceType === 'DiagnosticReport')
      diagnosticReportMap[`DiagnosticReport/${resource.id}`] = resource as DiagnosticReport;
  });

  const labOrderResults: LabOrderResult[] = [];
  const reflexOrderResults: LabOrderResultPDFConfig[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportRef = docRef.context?.related?.find(
      (related) => related.reference?.startsWith('DiagnosticReport')
    )?.reference;
    if (diagnosticReportRef) {
      const relatedDR = diagnosticReportMap[diagnosticReportRef];
      const isReflex = relatedDR.meta?.tag?.find((t) => t.system === 'result-type' && t.display === 'reflex');
      const serviceRequestRef = relatedDR?.basedOn?.find((based) => based.reference?.startsWith('ServiceRequest'))
        ?.reference;
      if (serviceRequestRef) {
        const relatedSR = serviceRequestMap[serviceRequestRef];
        const orderNumber = relatedSR.identifier?.find((id) => id.system === LAB_ORDER_PLACER_ID_SYSTEM)?.value;
        const activityDef = relatedSR.contained?.find((resource) => resource.resourceType === 'ActivityDefinition');
        const testName = activityDef?.code?.coding?.find((c) => c.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display;
        const labName = activityDef?.publisher;
        let formattedName = `${testName} / ${labName}`;
        if (isReflex) {
          const reflexTestName = relatedDR.code.coding?.[0].display;
          formattedName = `${reflexTestName ? reflexTestName : 'Name missing'} (reflex)`;
        }

        const resultsConfigs = await getLabOrderResultPDFConfig(docRef, formattedName, m2mtoken, orderNumber);
        if (isReflex) {
          reflexOrderResults.push(...resultsConfigs);
        } else {
          labOrderResults.push(...resultsConfigs);
        }
      } else {
        // todo what to do here for unsolicited results
        // maybe we don't need to handle these for mvp
        console.log('no serviceRequestRef for', docRef.id);
      }
    } else {
      console.log('no diagnosticReportRef for', docRef.id);
      // something has gone awry during the document reference creation if there is no diagnostic report linked
      // so this shouldnt happen but if it does we will still surface the report
      const formattedName = 'Lab order result pdf - missing details';
      const resultsConfigs = await getLabOrderResultPDFConfig(docRef, formattedName, m2mtoken);
      labOrderResults.push(...resultsConfigs);
    }
  }

  // map reflex tests to their original ordered test
  reflexOrderResults.forEach((reflexRes) => {
    const ogOrderResIdx = labOrderResults.findIndex(
      (res) => res?.orderNumber && res.orderNumber === reflexRes.orderNumber
    );
    if (!labOrderResults[ogOrderResIdx].reflexResults) {
      labOrderResults[ogOrderResIdx].reflexResults = [reflexRes];
    } else {
      labOrderResults[ogOrderResIdx].reflexResults.push(reflexRes);
    }
  });

  // todo confirm this logic is sound
  const resultsPending = activeServiceRequests.length > 0;

  const result: EncounterLabResult = {
    resultsPending,
    labOrderResults,
  };
  return result;
};

const getLabOrderResultPDFConfig = async (
  docRef: DocumentReference,
  formattedName: string,
  m2mtoken: string,
  orderNumber?: string
): Promise<LabOrderResultPDFConfig[]> => {
  const results: LabOrderResultPDFConfig[] = [];
  for (const content of docRef.content) {
    const z3Url = content.attachment.url;
    if (z3Url) {
      const url = await getPresignedURL(z3Url, m2mtoken);
      const labResult: LabOrderResultPDFConfig = {
        name: formattedName,
        url,
        orderNumber,
      };
      results.push(labResult);
    }
  }

  return results;
};

export const configGetChartDataLabRequests = (encounterId: string): BatchInputGetRequest[] => {
  // todo get this from a const, waiting for pdf logic to merge
  const LAB_RESULT_CODE = '51991-8';

  const docRefSearch: BatchInputGetRequest = {
    method: 'GET',
    url: `/DocumentReference?type=${LAB_RESULT_CODE}&encounter=${encounterId}&_include:iterate=DocumentReference:related&_include:iterate=DiagnosticReport:based-on`,
  };
  const activeLabServiceRequestSearch: BatchInputGetRequest = {
    method: 'GET',
    url: `/ServiceRequest?encounter=Encounter/${encounterId}&status=active`,
  };
  return [docRefSearch, activeLabServiceRequestSearch];
};

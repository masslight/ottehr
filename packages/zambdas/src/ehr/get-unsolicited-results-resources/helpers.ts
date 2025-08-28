import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  Appointment,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Organization,
  Patient,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import {
  DR_UNSOLICITED_PATIENT_REF,
  DR_UNSOLICITED_PRACTITIONER_REF,
  getFullestAvailableName,
  getTestItemCodeFromDR,
  getTestNameFromDR,
  GetUnsolicitedResultsResourcesForIcon,
  GetUnsolicitedResultsResourcesForMatch,
  GetUnsolicitedResultsResourcesForTable,
  LAB_ORDER_TASK,
  OYSTEHR_LAB_GUID_SYSTEM,
  RelatedRequestsToUnsolicitedResultOutput,
  UnsolicitedResultTaskRowDTO,
  UR_TASK_ACTION,
} from 'utils';

export const getUnsolicitedDRandRelatedResources = async (
  oystehr: Oystehr,
  additionalQueryParams?: SearchParam[]
): Promise<FhirResource[]> => {
  const additionalParams = additionalQueryParams ? additionalQueryParams : [];

  console.log('making search request for unsolicited results tasks and drs');
  const resourceSearch = (
    await oystehr.fhir.search<FhirResource>({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: '_tag',
          value: 'unsolicited',
        },
        { name: '_has:Task:based-on:status', value: 'ready' },
        { name: '_revinclude', value: 'Task:based-on' },
        ...additionalParams,
      ],
    })
  ).unbundle();

  return resourceSearch;
};

export const handleIconResourceRequest = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr);
  return {
    tasksAreReady: resources.length > 0,
  };
};

export const handleGetTasks = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForTable> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr, [
    { name: '_include', value: 'DiagnosticReport:subject' },
    { name: '_include', value: 'DiagnosticReport:performer' },
  ]);
  console.log('grouping the resources returned by diagnostic report', resources.length);
  const groupedResources = groupResourcesByDr(resources);
  console.log('formatting the resources for response');
  const rows = formatResourcesForTaskTableResponse(groupedResources);
  console.log('returning formatted rows', rows.length);
  return { unsolicitedResultRows: rows };
};

export const handleUnsolicitedRequestMatch = async (
  oystehr: Oystehr,
  diagnosticReportId: string
): Promise<GetUnsolicitedResultsResourcesForMatch> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr, [
    { name: '_id', value: diagnosticReportId },
    { name: '_include', value: 'DiagnosticReport:subject' },
  ]);
  console.log('grouping the resources returned by diagnostic report', resources.length);
  const groupedResources = groupResourcesByDr([...resources]);

  const entries = Object.values(groupedResources);
  const entriesMade = entries.length;
  if (entriesMade > 1) {
    throw Error('More than one diagnostic report found for this unsolicited result task detail page');
  } else if (entriesMade === 0) {
    throw Error('No diagnostic report found for this unsolicited result task detail page');
  }

  const resourceEntry = entries[0];
  console.log('formatting the resources for unsolicited result task detail page');
  const response = formatResourcesForURMatchTaskResponse(resourceEntry);
  return response;
};

export const handleGetPossibleRelatedRequestsToUnsolicitedResult = async (
  oystehr: Oystehr,
  diagnosticReportId: string,
  patientId: string
): Promise<RelatedRequestsToUnsolicitedResultOutput> => {
  const diagnosticReport = await oystehr.fhir.get<DiagnosticReport>({
    resourceType: 'DiagnosticReport',
    id: diagnosticReportId,
  });
  if (!diagnosticReport) throw Error(`could not find diagnostic report with id ${diagnosticReportId}`);

  // if patient id is passed as a param that means the user has matched a patient for the unsolicited result and we now have enough info
  // to determine if the result can be matched to an existing SR
  const possibleRelatedSRsWithVisitDate = patientId
    ? await getEncountersPossiblyRelatedToUnsolicitedResult(patientId, diagnosticReport, oystehr)
    : null;

  console.log('response for unsolicited results related requests successfully formatted');
  return { possibleRelatedSRsWithVisitDate };
};

type AllResources = {
  diagnosticReport: DiagnosticReport;
  readyTasks: Task[];
  patient?: Patient;
  labOrg?: Organization;
};
type ResourcesByDr = {
  [diagnosticReportId: string]: AllResources;
};

const groupResourcesByDr = (resources: FhirResource[]): ResourcesByDr => {
  const drMap: ResourcesByDr = {};
  const readyTasks: Task[] = [];
  const patients: Patient[] = [];
  const patientRefToRelatedDrMap: Record<string, string> = {};
  const orgRefToRelatedDrMap: Record<string, string> = {};
  const labOrganizations: Organization[] = [];
  resources.forEach((resource) => {
    if (resource.resourceType === 'DiagnosticReport') {
      if (resource.id) {
        drMap[resource.id] = { diagnosticReport: resource, readyTasks: [] };
        const isPatientSubject = resource.subject?.reference?.startsWith('Patient/');
        if (isPatientSubject) {
          const patientRef = resource.subject?.reference;
          if (patientRef) patientRefToRelatedDrMap[patientRef] = resource.id;
        }
        const orgPerformer = resource.performer?.find((p) => p.reference?.startsWith('Organization/'))?.reference;
        if (orgPerformer) orgRefToRelatedDrMap[orgPerformer] = resource.id;
      }
    }
    if (resource.resourceType === 'Organization') {
      const isLabOrg = !!resource.identifier?.some((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM);
      if (isLabOrg) labOrganizations.push(resource);
    }
    if (resource.resourceType === 'Task' && resource.status === 'ready') readyTasks.push(resource);
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
  patients.forEach((patient) => {
    const patientRef = `Patient/${patient.id}`;
    const drId = patientRefToRelatedDrMap[patientRef];
    drMap[drId].patient = patient;
  });
  labOrganizations.forEach((labOrg) => {
    const labOrgRef = `Organization/${labOrg.id}`;
    const drId = orgRefToRelatedDrMap[labOrgRef];
    drMap[drId].labOrg = labOrg;
  });
  return drMap;
};

const formatResourcesForTaskTableResponse = (resources: ResourcesByDr): UnsolicitedResultTaskRowDTO[] => {
  const rows = Object.values(resources).flatMap((relatedResources) => {
    const taskDetails: UnsolicitedResultTaskRowDTO[] = [];
    relatedResources.readyTasks.forEach((task) => {
      const taskCode = task.code?.coding?.find((c) => c.system === LAB_ORDER_TASK.system)?.code;
      if (taskCode && taskIsLabRelated(taskCode)) {
        const { diagnosticReport, patient, labOrg } = relatedResources;
        const taskRowDescription = getURDescriptionText(taskCode, diagnosticReport, patient, labOrg);
        const { actionText, actionUrl } = getURActionTextAndUrl(taskCode, diagnosticReport);

        const row: UnsolicitedResultTaskRowDTO = {
          diagnosticReportId: diagnosticReport.id || 'unknown',
          actionText,
          actionUrl,
          taskRowDescription,
          resultsReceivedDateTime: task.authoredOn || 'unknown',
        };
        taskDetails.push(row);
      }
    });
    return taskDetails;
  });
  return rows;
};

const getURDescriptionText = (
  code: string,
  diagnosticReport: DiagnosticReport,
  patient?: Patient,
  labOrg?: Organization
): string => {
  const testName = getTestNameFromDR(diagnosticReport);
  const testItemCode = getTestItemCodeFromDR(diagnosticReport);
  const testDescription = testName || testItemCode || 'missing test name';
  const labName = labOrg?.name || 'Source lab not specified';

  // only matched results will have patient linked
  const patientName = patient ? getFullestAvailableName(patient, true) : undefined;

  switch (code) {
    case LAB_ORDER_TASK.code.matchUnsolicitedResult: {
      return 'Match unsolicited test results';
    }
    case LAB_ORDER_TASK.code.reviewCancelledResult:
    case LAB_ORDER_TASK.code.reviewCorrectedResult:
    case LAB_ORDER_TASK.code.reviewFinalResult:
    case LAB_ORDER_TASK.code.reviewPreliminaryResult: {
      if (!patientName) {
        throw Error(`Cannot parse patient name for this matched unsolicited result ${diagnosticReport.id}`);
      }
      return `Review unsolicited test results for "${testDescription} / ${labName}" for ${patientName}`;
    }
    default: {
      throw Error(`Task code passed to getURDescriptionText does not match expected input: ${code}`);
    }
  }
};

const getURActionTextAndUrl = (
  code: string,
  diagnosticReport: DiagnosticReport
): { actionText: UR_TASK_ACTION; actionUrl: string } => {
  switch (code) {
    case LAB_ORDER_TASK.code.matchUnsolicitedResult: {
      return { actionText: 'Match', actionUrl: `/match-unsolicited-result/${diagnosticReport.id}` };
    }
    case LAB_ORDER_TASK.code.reviewCancelledResult:
    case LAB_ORDER_TASK.code.reviewCorrectedResult:
    case LAB_ORDER_TASK.code.reviewFinalResult:
    case LAB_ORDER_TASK.code.reviewPreliminaryResult: {
      return { actionText: 'Go to Lab Results', actionUrl: '/visits' }; // todo temp until results screen ticket is done
    }
    default: {
      throw Error(`Task code passed to getURActionText does not match expected input: ${code}`);
    }
  }
};

const getTestNameFromDr = (dr: DiagnosticReport): string => {
  const testName = getTestNameFromDR(dr);
  const testItemCode = getTestItemCodeFromDR(dr);
  const testDescription = testName || testItemCode || '';
  return testDescription;
};

const taskIsLabRelated = (code: string): boolean => {
  const relevantLabCodes: string[] = [
    LAB_ORDER_TASK.code.matchUnsolicitedResult,
    LAB_ORDER_TASK.code.reviewCancelledResult,
    LAB_ORDER_TASK.code.reviewCorrectedResult,
    LAB_ORDER_TASK.code.reviewFinalResult,
    LAB_ORDER_TASK.code.reviewPreliminaryResult,
  ];
  return relevantLabCodes.includes(code);
};

const formatResourcesForURMatchTaskResponse = (resources: AllResources): GetUnsolicitedResultsResourcesForMatch => {
  const { diagnosticReport, readyTasks } = resources;

  const { unsolicitedPatient, unsolicitedProvider } = getUnsolicitedResourcesFromDr(diagnosticReport);
  const task = readyTasks.find(
    (task) =>
      task.code?.coding?.find(
        (c) => c.system === LAB_ORDER_TASK.system && c.code === LAB_ORDER_TASK.code.matchUnsolicitedResult
      )
  );
  if (!task?.id) throw Error(`Could not parse match unsolicited result task id`);

  const patientName = unsolicitedPatient ? getFullestAvailableName(unsolicitedPatient, true) : undefined;
  const patientDOB = unsolicitedPatient?.birthDate;
  const providerName = unsolicitedProvider ? getFullestAvailableName(unsolicitedProvider, true) : undefined;
  const test = getTestNameFromDr(diagnosticReport);
  const resultsReceived = diagnosticReport.effectiveDateTime;

  const labInfo: GetUnsolicitedResultsResourcesForMatch['labInfo'] = {
    patientName,
    patientDOB,
    provider: providerName,
    test,
    resultsReceived,
  };
  return { labInfo, taskId: task.id };
};

const getUnsolicitedResourcesFromDr = (
  dr: DiagnosticReport
): { unsolicitedPatient: Patient | undefined; unsolicitedProvider: Practitioner | undefined } => {
  let unsolicitedPatient: Patient | undefined;
  let unsolicitedProvider: Practitioner | undefined;

  const containedPatient = dr.contained?.find(
    (resource) => resource.resourceType === 'Patient' && resource.id === DR_UNSOLICITED_PATIENT_REF
  );
  if (containedPatient) {
    unsolicitedPatient = containedPatient as Patient;
  }
  const containedProvider = dr.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.id === DR_UNSOLICITED_PRACTITIONER_REF
  );
  if (containedProvider) {
    unsolicitedProvider = containedProvider as Practitioner;
  }
  return { unsolicitedPatient, unsolicitedProvider };
};

// get all encounters with an active service request with the same test code
const getEncountersPossiblyRelatedToUnsolicitedResult = async (
  patientId: string,
  dr: DiagnosticReport,
  oystehr: Oystehr
): Promise<
  | {
      serviceRequestId: string;
      visitDate: string;
    }[]
  | null
> => {
  const testItemCode = getTestItemCodeFromDR(dr);
  console.log('testItemCode parsed from unsolicited result dr:', testItemCode);
  if (!testItemCode) return null;
  console.log('searching for encounters, service requests and appointments with patientId', patientId);
  const resourceSearch = (
    await oystehr.fhir.search<Encounter | ServiceRequest | Appointment>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: 'subject',
          value: `Patient/${patientId}`,
        },
        {
          name: 'code',
          value: testItemCode,
        },
        {
          name: 'status',
          value: 'active',
        },
        {
          name: '_include',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_include:iterate',
          value: 'Encounter:appointment',
        },
      ],
    })
  ).unbundle();
  const serviceRequests: ServiceRequest[] = [];
  const encounterIdToAppointmentIdMap: Record<string, string> = {};
  const appointmentIdToVisitDateMap: Record<string, string> = {};

  console.log('resources return, formatting response');
  resourceSearch.forEach((resource) => {
    if (resource.resourceType === 'ServiceRequest') serviceRequests.push(resource);
    if (resource.resourceType === 'Encounter') {
      const encounterId = resource.id;
      const appointmentId = resource.appointment?.[0].reference?.replace('Appointment/', '');
      if (encounterId && appointmentId) {
        encounterIdToAppointmentIdMap[encounterId] = appointmentId;
      }
    }
    if (resource.resourceType === 'Appointment') {
      const appointmentId = resource.id;
      const visitDate = resource.start;
      if (appointmentId && visitDate) appointmentIdToVisitDateMap[appointmentId] = visitDate;
    }
  });

  // if any encounter has more than one service request with the same code, don't include (should really never happen)
  // for mvp its to hard to match since we are only using the encounter date
  const uniqueEncounterIds = new Set();
  serviceRequests.forEach((sr) => {
    const encounterId = sr.encounter?.reference?.replace('Encounter/', '');
    if (encounterId) {
      if (!uniqueEncounterIds.has(encounterId)) {
        uniqueEncounterIds.add(encounterId);
      } else {
        uniqueEncounterIds.delete(encounterId);
      }
    }
  });

  console.log('grouping visits dates with service request ids');
  const serviceRequestIdToVisitDateMap: Record<string, string> = {};
  serviceRequests.forEach((sr) => {
    const srId = sr.id;
    if (srId) {
      const encounterId = sr.encounter?.reference?.replace('Encounter/', '');
      if (encounterId) {
        if (uniqueEncounterIds.has(encounterId)) {
          const relatedAppointmentId = encounterIdToAppointmentIdMap[encounterId];
          if (relatedAppointmentId) {
            const visitDate = appointmentIdToVisitDateMap[relatedAppointmentId];
            if (visitDate) {
              serviceRequestIdToVisitDateMap[srId] = visitDate;
            }
          }
        }
      }
    }
  });

  console.log('formatting into array');
  const serviceRequestsWithVisitDates = Object.entries(serviceRequestIdToVisitDateMap).map(([srId, visitDate]) => {
    return { serviceRequestId: srId, visitDate };
  });

  console.log(`${serviceRequestsWithVisitDates.length} service requests with dates to be returned`);
  if (serviceRequestsWithVisitDates.length) return serviceRequestsWithVisitDates;
  return null;
};

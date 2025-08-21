import Oystehr, { BatchInputGetRequest, Bundle } from '@oystehr/sdk';
import { DiagnosticReport, FhirResource, Patient, Practitioner, Task } from 'fhir/r4b';
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
  UnsolicitedResultTaskRowDTO,
  UR_TASK_ACTION,
} from 'utils';
import { parseBundleResources } from '../get-chart-data/helpers';

const getUnsolicitedDRandRelatedResources = async (
  oystehr: Oystehr,
  additionalQueryParams?: string[]
): Promise<FhirResource[]> => {
  const getUnsolicitedDRsAndRelatedResources: BatchInputGetRequest = {
    method: 'GET',
    url: `/DiagnosticReport?_tag=unsolicited&_has:Task:based-on:status=ready&_revinclude=Task:based-on${
      additionalQueryParams ? additionalQueryParams.map((param) => `&${param}`).join('') : ''
    }`,
  };

  console.log('making transaction request for unsolicited results tasks and drs');
  const bundle: Bundle<FhirResource> = await oystehr.fhir.transaction({
    requests: [getUnsolicitedDRsAndRelatedResources],
  });
  const resources = parseBundleResources(bundle);
  return resources;
};

export const handleIconResourceRequest = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr);
  return {
    tasksAreReady: resources.length > 0,
  };
};

export const handleGetTasks = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForTable> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr, ['_include=DiagnosticReport:subject']);
  console.log('grouping the resources returned by diagnostic report', resources.length);
  const groupedResources = groupResourcesByDr(resources);
  console.log('formatting the resources for response');
  const rows = formatResourcesForTaskTableResponse(groupedResources);
  console.log('returning formatted rows', rows.length);
  return { unsolicitedResultTasks: rows };
};

export const handleUnsolicitedRequestMatch = async (
  oystehr: Oystehr,
  diagnosticReportId: string
): Promise<GetUnsolicitedResultsResourcesForMatch> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr, [
    `_id=${diagnosticReportId}`,
    '_include=DiagnosticReport:subject',
  ]);
  console.log('grouping the resources returned by diagnostic report', resources.length);
  const groupedResources = groupResourcesByDr(resources);
  const entries = Object.values(groupedResources);
  if (entries.length > 1) {
    throw Error('More than one diagnostic report found for this unsolicited result task detail page');
  }
  const resourceEntry = entries[0];
  console.log('formatting the resources for unsolicited result task detail page');
  const labInfo = formatResourcesForURMatchTaskResponse(resourceEntry);
  return { labInfo };
};

type AllResources = {
  diagnosticReport: DiagnosticReport;
  readyTasks: Task[];
  patient?: Patient;
};
type ResourcesByDr = {
  [diagnosticReportId: string]: AllResources;
};

const groupResourcesByDr = (resources: FhirResource[]): ResourcesByDr => {
  const drMap: ResourcesByDr = {};
  const diagnosticReports: DiagnosticReport[] = [];
  const readyTasks: Task[] = [];
  const patients: Patient[] = [];
  const patientRefToRelatedDrMap: Record<string, string> = {};
  resources.forEach((resource) => {
    if (resource.resourceType === 'DiagnosticReport') {
      diagnosticReports.push(resource);
      if (resource.id) {
        drMap[resource.id] = { diagnosticReport: resource, readyTasks: [] };
        const isPatientSubject = resource.subject?.reference?.startsWith('Patient/');
        if (isPatientSubject) {
          const patientRef = resource.subject?.reference;
          if (patientRef) patientRefToRelatedDrMap[patientRef] = resource.id;
        }
      }
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
  return drMap;
};

const formatResourcesForTaskTableResponse = (resources: ResourcesByDr): UnsolicitedResultTaskRowDTO[] => {
  const rows = Object.values(resources).flatMap((relatedResources) => {
    const taskDetails: UnsolicitedResultTaskRowDTO[] = [];
    relatedResources.readyTasks.forEach((task) => {
      const taskCode = task.code?.coding?.find((c) => c.system === LAB_ORDER_TASK.system)?.code;
      if (taskCode && taskIsLabRelated(taskCode)) {
        const { diagnosticReport, patient } = relatedResources;
        const taskRowDescription = getURDescriptionText(taskCode, diagnosticReport, patient);
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

const getURDescriptionText = (code: string, diagnosticReport: DiagnosticReport, patient?: Patient): string => {
  // todo sarah lab name should be included in the task row instruction
  // currently this is blocked by some oystehr dev to be able to grab the lab off of DR
  const testDescription = getTestNameFromDr(diagnosticReport);

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
      if (!patientName) throw Error('Cannot parse patient name for a matched unsolicited result');
      return `Review and accept/decline unsolicited results for "${testDescription}" for ${patientName}`;
    }
    default: {
      throw Error('Task code passed does not match expected input');
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
      throw Error('Task code passed does not match expected input');
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

const formatResourcesForURMatchTaskResponse = (
  resources: AllResources
): GetUnsolicitedResultsResourcesForMatch['labInfo'] => {
  const { diagnosticReport } = resources;

  const { unsolicitedPatient, unsolicitedProvider } = getUnsolicitedResourcesFromDr(diagnosticReport);
  // const task = readyTasks.find(
  //   (task) =>
  //     task.code?.coding?.find(
  //       (c) => c.system === LAB_ORDER_TASK.system && c.code === LAB_ORDER_TASK.code.matchUnsolicitedResult
  //     )
  // );
  // console.log('am i empty?', task?.id);

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
  return labInfo;
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

import Oystehr, { BatchInputGetRequest, Bundle } from '@oystehr/sdk';
import { DiagnosticReport, FhirResource, Patient, Task } from 'fhir/r4b';
import {
  getFullestAvailableName,
  getTestItemCodeFromDR,
  getTestNameFromDR,
  GetUnsolicitedResultsResourcesForIcon,
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
  const getUnsolicitedDRsWithTasks: BatchInputGetRequest = {
    method: 'GET',
    url: `/DiagnosticReport?_tag=unsolicited&_has:Task:based-on:status=ready&_revinclude=Task:based-on${
      additionalQueryParams ? additionalQueryParams.map((param) => `&${param}`) : ''
    }`,
  };

  console.log('making transaction request for unsolicited results tasks and drs');
  const bundle: Bundle<FhirResource> = await oystehr.fhir.transaction({
    requests: [getUnsolicitedDRsWithTasks],
  });
  const resources = parseBundleResources(bundle);
  return resources;
};

export const handleRequestForIcon = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr);
  return {
    tasksAreReady: resources.length > 0,
  };
};

export const handleGetTasks = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForTable> => {
  const resources = await getUnsolicitedDRandRelatedResources(oystehr, ['_include=DiagnosticReport:subject']);
  console.log('grouping the resources returned by diagnostic report', resources.length);
  const groupedResources = groupReadyTasksByDr(resources);
  console.log('formatting the resources for response');
  const rows = formatResourcesForResponse(groupedResources);
  console.log('returning formatted rows', rows.length);
  return { unsolicitedResultTasks: rows };
};

type ReadyTasksByDr = {
  [diagnosticReportId: string]: {
    diagnosticReport: DiagnosticReport;
    readyTasks: Task[];
    patient?: Patient;
  };
};

const groupReadyTasksByDr = (resources: FhirResource[]): ReadyTasksByDr => {
  const drMap: ReadyTasksByDr = {};
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

const formatResourcesForResponse = (readyTasksByDr: ReadyTasksByDr): UnsolicitedResultTaskRowDTO[] => {
  const rows = Object.values(readyTasksByDr).flatMap((relatedResources) => {
    const taskDetails: UnsolicitedResultTaskRowDTO[] = [];
    relatedResources.readyTasks.forEach((task) => {
      const taskCode = task.code?.coding?.find((c) => c.system === LAB_ORDER_TASK.system)?.code;
      if (taskCode && taskIsLabRelated(taskCode)) {
        const { diagnosticReport, patient } = relatedResources;
        const taskRowDescription = getURDescriptionText(taskCode, diagnosticReport, patient);
        const actionText = getURActionText(taskCode);

        const row: UnsolicitedResultTaskRowDTO = {
          diagnosticReportId: diagnosticReport.id || 'unknown',
          actionText,
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
  const testName = getTestNameFromDR(diagnosticReport);
  const testItemCode = getTestItemCodeFromDR(diagnosticReport);
  const testDescription = testName || testItemCode || '';

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

const getURActionText = (code: string): UR_TASK_ACTION => {
  switch (code) {
    case LAB_ORDER_TASK.code.matchUnsolicitedResult: {
      return 'Match';
    }
    case LAB_ORDER_TASK.code.reviewCancelledResult:
    case LAB_ORDER_TASK.code.reviewCorrectedResult:
    case LAB_ORDER_TASK.code.reviewFinalResult:
    case LAB_ORDER_TASK.code.reviewPreliminaryResult: {
      return 'Go to Lab Results';
    }
    default: {
      throw Error('Task code passed does not match expected input');
    }
  }
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

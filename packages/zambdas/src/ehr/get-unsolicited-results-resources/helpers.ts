import Oystehr, { SearchParam } from '@oystehr/sdk';
import { DiagnosticReport, FhirResource, Organization, Patient, Task } from 'fhir/r4b';
import {
  getFullestAvailableName,
  getTestItemCodeFromDR,
  getTestNameFromDR,
  GetUnsolicitedResultsResourcesForIcon,
  GetUnsolicitedResultsResourcesForTable,
  LAB_ORDER_TASK,
  OYSTEHR_LAB_GUID_SYSTEM,
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

export const handleRequestForIcon = async (oystehr: Oystehr): Promise<GetUnsolicitedResultsResourcesForIcon> => {
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
    labOrg?: Organization;
  };
};

const groupReadyTasksByDr = (resources: FhirResource[]): ReadyTasksByDr => {
  const drMap: ReadyTasksByDr = {};
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

const formatResourcesForResponse = (readyTasksByDr: ReadyTasksByDr): UnsolicitedResultTaskRowDTO[] => {
  const rows = Object.values(readyTasksByDr).flatMap((relatedResources) => {
    const taskDetails: UnsolicitedResultTaskRowDTO[] = [];
    relatedResources.readyTasks.forEach((task) => {
      const taskCode = task.code?.coding?.find((c) => c.system === LAB_ORDER_TASK.system)?.code;
      if (taskCode && taskIsLabRelated(taskCode)) {
        const { diagnosticReport, patient, labOrg } = relatedResources;
        const taskRowDescription = getURDescriptionText(taskCode, diagnosticReport, patient, labOrg);
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
      throw Error(`Task code passed to getURActionText does not match expected input: ${code}`);
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

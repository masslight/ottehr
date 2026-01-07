import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, Encounter, Organization, Patient, Task } from 'fhir/r4b';
import { LAB_ORDER_TASK, LabOrderTaskCode } from 'utils';

export const ACCEPTED_RESULTS_STATUS = ['preliminary', 'final', 'corrected', 'cancelled'];
type AcceptedResultsStatus = (typeof ACCEPTED_RESULTS_STATUS)[number];

const STATUS_CODE_MAP: Record<AcceptedResultsStatus, LabOrderTaskCode> = {
  preliminary: LAB_ORDER_TASK.code.reviewPreliminaryResult,
  final: LAB_ORDER_TASK.code.reviewFinalResult,
  corrected: LAB_ORDER_TASK.code.reviewCorrectedResult,
  cancelled: LAB_ORDER_TASK.code.reviewCancelledResult,
};

export const getCodeForNewTask = (dr: DiagnosticReport, isUnsolicited: boolean, matched: boolean): string => {
  if (isUnsolicited && !matched) {
    return LAB_ORDER_TASK.code.matchUnsolicitedResult;
  } else {
    return STATUS_CODE_MAP[dr.status];
  }
};

export async function fetchRelatedResources(
  diagnosticReport: DiagnosticReport,
  oystehr: Oystehr
): Promise<{
  tasks: Task[];
  patient?: Patient;
  labOrg?: Organization;
  encounter?: Encounter;
}> {
  const resources = (
    await oystehr.fhir.search<DiagnosticReport | Patient | Organization | Task | Encounter>({
      resourceType: 'DiagnosticReport',
      params: [
        { name: '_id', value: diagnosticReport.id ?? '' },
        { name: '_revinclude:iterate', value: 'Task:based-on' },
        { name: '_include', value: 'DiagnosticReport:subject' }, // patient
        { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
        { name: '_include', value: 'DiagnosticReport:encounter' }, // to grab the appointment id
      ],
    })
  ).unbundle();

  const serviceRequestId = diagnosticReport?.basedOn
    ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
    ?.reference?.split('/')[1];

  const preSubmissionTask = serviceRequestId
    ? (
        await oystehr.fhir.search<Task>({
          resourceType: 'Task',
          params: [
            { name: 'based-on', value: `ServiceRequest/${serviceRequestId}` },
            { name: 'code', value: LAB_ORDER_TASK.system + '|' + LAB_ORDER_TASK.code.preSubmission },
          ],
        })
      ).unbundle()[0]
    : undefined;

  if (preSubmissionTask) {
    resources.push(preSubmissionTask);
  }

  const result: {
    tasks: Task[];
    patient?: Patient;
    labOrg?: Organization;
    encounter?: Encounter; // unsolicited results will not have
  } = { tasks: [] };

  resources.forEach((resource) => {
    if (resource.resourceType === 'Task') {
      result.tasks.push(resource);
    }
    if (resource.resourceType === 'Patient') {
      result.patient = resource;
    }
    if (resource.resourceType === 'Organization') {
      result.labOrg = resource;
    }
    if (resource.resourceType === 'Encounter') {
      result.encounter = resource;
    }
  });

  return result;
}

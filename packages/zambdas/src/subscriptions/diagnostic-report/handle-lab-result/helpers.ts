import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, Organization, Patient, Task } from 'fhir/r4b';
import { LAB_DR_TYPE_TAG, LAB_ORDER_TASK, LabOrderTaskCode, LabType } from 'utils';
import { getAllDrTags } from '../../../ehr/shared/labs';

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

export const isUnsolicitedResult = (specificTag: LabType | undefined, dr: DiagnosticReport): boolean => {
  if (!specificTag) return false;
  if (specificTag === LAB_DR_TYPE_TAG.code.unsolicited) return true;
  if (specificTag === LAB_DR_TYPE_TAG.code.attachment) {
    // check if tag also contains unsolicited (we are treating pdf as the primary tag and unsolicited as something secondary)
    const allTags = getAllDrTags(dr);
    const unsolicitedTagIsContained = allTags?.includes(LabType.unsolicited);
    // this is a backup method for checking if the attachment DR is undefined
    const patientSubjectIsFound = !!dr.subject?.reference?.startsWith('Patient/');
    return unsolicitedTagIsContained || !patientSubjectIsFound;
  }
  return false;
};

export async function fetchRelatedResources(
  diagnosticReport: DiagnosticReport,
  oystehr: Oystehr
): Promise<{
  tasks: Task[];
  patient?: Patient;
  labOrg?: Organization;
}> {
  const resources = (
    await oystehr.fhir.search<DiagnosticReport | Patient | Organization | Task>({
      resourceType: 'DiagnosticReport',
      params: [
        { name: '_id', value: diagnosticReport.id ?? '' },
        { name: '_revinclude:iterate', value: 'Task:based-on' },
        { name: '_include', value: 'DiagnosticReport:subject' }, // patient
        { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
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
  });

  return result;
}

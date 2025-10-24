import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { DiagnosticReport, FhirResource, Organization, Patient, Task } from 'fhir/r4b';
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
  const patientReference = diagnosticReport.subject?.reference;
  const serviceRequestReference = diagnosticReport?.basedOn?.find(
    (temp) => temp.reference?.startsWith('ServiceRequest/')
  )?.reference;
  const labOrgReference = diagnosticReport.performer?.find(
    (performer) => performer.reference != null && performer.reference.startsWith('Organization')
  )?.reference;
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'GET',
      url: `/Task?based-on=DiagnosticReport/${diagnosticReport.id}${
        serviceRequestReference ? ',' + serviceRequestReference : ''
      }`,
    },
  ];
  if (patientReference) {
    requests.push({
      method: 'GET',
      url: `/${patientReference}`,
    });
  }
  if (labOrgReference) {
    requests.push({
      method: 'GET',
      url: `/${labOrgReference}`,
    });
  }
  console.log(`requests:\n${JSON.stringify(requests, null, 2)}`);
  const resources = (
    await oystehr.fhir.batch({
      requests,
    })
  ).unbundle();
  return {
    tasks: resources.filter((resource) => resource.resourceType === 'Task'),
    patient: resources.find((resource) => resource.resourceType === 'Patient'),
    labOrg: resources.find((resource) => resource.resourceType === 'Organization'),
  };
}

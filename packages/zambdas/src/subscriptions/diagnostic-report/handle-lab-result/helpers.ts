import { CodeableConcept, DiagnosticReport, Task } from 'fhir/r4b';
import { LAB_ORDER_TASK, LabOrderTaskCode } from 'utils';

export const ACCEPTED_RESULTS_STATUS = ['preliminary', 'final', 'corrected', 'cancelled'];
type AcceptedResultsStatus = (typeof ACCEPTED_RESULTS_STATUS)[number];
export const getStatusForNewTask = (incomingResultsStatus: AcceptedResultsStatus): Task['status'] => {
  return incomingResultsStatus === 'cancelled' ? 'completed' : 'ready';
};

const STATUS_CODE_MAP: Record<AcceptedResultsStatus, LabOrderTaskCode> = {
  preliminary: LAB_ORDER_TASK.code.reviewPreliminaryResult,
  final: LAB_ORDER_TASK.code.reviewFinalResult,
  corrected: LAB_ORDER_TASK.code.reviewCorrectedResult,
  cancelled: LAB_ORDER_TASK.code.reviewCancelledResult,
};

export const getCodeForNewTask = (dr: DiagnosticReport, isUnsolicited: boolean, matched: boolean): CodeableConcept => {
  if (isUnsolicited && !matched) {
    return labOrderTaskCoding(LAB_ORDER_TASK.code.matchUnsolicitedResult);
  } else {
    return getReviewResultCodeForNewTask(dr.status);
  }
};

export const getReviewResultCodeForNewTask = (incomingResultsStatus: AcceptedResultsStatus): CodeableConcept => {
  return labOrderTaskCoding(STATUS_CODE_MAP[incomingResultsStatus]);
};

const labOrderTaskCoding = (code: LabOrderTaskCode): CodeableConcept => {
  return {
    coding: [
      {
        system: LAB_ORDER_TASK.system,
        code,
      },
    ],
  };
};

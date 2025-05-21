import { TestStatus, IN_HOUSE_LAB_TASK, IN_HOUSE_LAB_DOCREF_CATEGORY } from 'utils';
import { Coding } from 'fhir/r4b';

export function determineOrderStatus(serviceRequest: any, tasks: any[]): TestStatus {
  if (!serviceRequest) return 'ORDERED';

  const collectSampleTask = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.collectSampleTask
      )
  );
  console.log('collectSampleTask', collectSampleTask?.id, collectSampleTask?.status);

  const interpretResultsTask = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.inputResultsTask // todo: is it valid?
      )
  );
  console.log('interpretResultsTask', interpretResultsTask?.id, interpretResultsTask?.status);

  const documentReference = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_DOCREF_CATEGORY.system &&
          coding.code === IN_HOUSE_LAB_DOCREF_CATEGORY.code.resultForm
      )
  );

  // Status Derivation:
  // Ordered: SR.status = draft & Task(CST).status = ready
  if (serviceRequest.status === 'draft' && collectSampleTask?.status === 'ready') {
    return 'ORDERED';
  }

  // Collected: SR.status = active & Task(CST).status = completed & Task(IRT).status = ready
  if (
    serviceRequest.status === 'active' &&
    collectSampleTask?.status === 'completed' &&
    interpretResultsTask?.status === 'ready'
  ) {
    return 'COLLECTED';
  }

  // Final: SR.status = completed && DR.status = 'final'
  if (
    serviceRequest.status === 'completed' &&
    (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

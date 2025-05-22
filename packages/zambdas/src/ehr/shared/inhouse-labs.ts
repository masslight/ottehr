import { TestStatus, IN_HOUSE_LAB_TASK, PROVENANCE_ACTIVITY_CODING_ENTITY } from 'utils';
import { Coding, Task, ServiceRequest, Provenance } from 'fhir/r4b';

export function determineOrderStatus(serviceRequest: ServiceRequest, tasks: Task[]): TestStatus {
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

  // todo i don't think we need this actually
  // const documentReference = tasks.find(
  //   (task) =>
  //     task.code?.coding?.some(
  //       (coding: Coding) =>
  //         coding.system === IN_HOUSE_LAB_DOCREF_CATEGORY.system &&
  //         coding.code === IN_HOUSE_LAB_DOCREF_CATEGORY.code.resultForm
  //     )
  // );

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
    serviceRequest.status === 'completed'
    // todo temp commenting this out while i wait on confirmation of logic
    // (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

// todo can we use determineOrderStatus below?
export function buildOrderHistory(
  provenances: Provenance[]
  // providerName: string,
  // currentPractitionerName: string
): {
  status: TestStatus;
  providerName: string;
  date: string;
}[] {
  const history: {
    status: TestStatus;
    providerName: string;
    date: string;
  }[] = [];

  // todo: it seems that adding from provenances is enough, so we can remove this
  // Add order creation entry if we have a service request
  // if (serviceRequest?.authoredOn) {
  //   history.push({
  //     status: 'ORDERED',
  //     providerName,
  //     date: serviceRequest.authoredOn,
  //   });
  // }

  // Add entries from provenances
  provenances.forEach((provenance) => {
    const activityCode = provenance.activity?.coding?.[0]?.code;

    // Map activity codes to statuses
    let status: TestStatus | undefined;

    if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
      status = 'ORDERED';
    } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.collectSpecimen?.code) {
      status = 'COLLECTED';
    } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.submit?.code) {
      status = 'FINAL';
    }

    if (status && provenance.recorded) {
      const agentName = provenance.agent?.[0]?.who?.display || '';

      history.push({
        status,
        providerName: agentName,
        date: provenance.recorded,
      });
    }
  });

  history.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return history;
}

import {
  TestStatus,
  IN_HOUSE_LAB_TASK,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  PRACTITIONER_CODINGS,
  SPECIMEN_COLLECTION_SOURCE_SYSTEM,
  SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
  InHouseOrderDetailPageDTO,
} from 'utils';
import { Coding, Task, ServiceRequest, Provenance, Encounter, Specimen } from 'fhir/r4b';

export function getAttendingPractionerId(encounter: Encounter): string {
  const practitionerId = encounter.participant
    ?.find(
      (participant) =>
        participant.type?.find((type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system))
    )
    ?.individual?.reference?.replace('Practitioner/', '');

  if (!practitionerId) throw Error('Attending practitioner not found');
  return practitionerId;
}

export function determineOrderStatus(serviceRequest: ServiceRequest, tasks: Task[]): TestStatus {
  if (!serviceRequest) return 'ORDERED';

  const collectSampleTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.collectSampleTask
      )
  );
  console.log('collectSampleTask', collectSampleTask?.id, collectSampleTask?.status);

  const interpretResultsTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.inputResultsTask // todo: is it valid?
      )
  );
  console.log('interpretResultsTask', interpretResultsTask?.id, interpretResultsTask?.status);

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
    // todo commenting this out for now as its not needed but that may change when we allow edits
    // (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

export function buildOrderHistory(
  provenances: Provenance[],
  serviceRequest: ServiceRequest,
  specimen?: Specimen
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

  // Add entries from provenances
  provenances.forEach((provenance) => {
    const relatedToSR = provenanceIsTargetOfServiceRequest(provenance, serviceRequest);
    if (relatedToSR) {
      const activityCode = provenance.activity?.coding?.[0]?.code;

      // Map activity codes to statuses
      let status: TestStatus | undefined;

      if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
        status = 'ORDERED';
      } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults.code) {
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
    }
  });

  if (specimen) {
    const collectedByDisplay = specimen.collection?.collector?.display || '';
    const collectedByDate = specimen.collection?.collectedDateTime;

    if (collectedByDate) {
      history.push({
        status: 'COLLECTED',
        providerName: collectedByDisplay,
        date: collectedByDate,
      });
    }
  }

  history.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return history;
}

export const getSpecimenDetails = (specimen: Specimen): InHouseOrderDetailPageDTO['specimen'] => {
  const specimenCollection = specimen.collection;
  if (specimenCollection) {
    const standardizedSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_SOURCE_SYSTEM
    )?.display;
    const customSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM
    )?.display;
    const sources = [];
    if (standardizedSource) sources.push(standardizedSource);
    if (customSource) sources.push(customSource);

    // todo not sure if we want to split like this, think it might cause issues with timezones
    const collectedDateTimeIso = specimen.collection?.collectedDateTime;
    const collectedDate = collectedDateTimeIso?.split('T')[0];
    const collectedTime = collectedDateTimeIso?.split('T')[1].split('.')[0];

    const specimenDetails = {
      source: sources.join(', '),
      collectedBy: specimen.collection?.collector?.display || '',
      collectionDate: collectedDate || '',
      collectionTime: collectedTime || '',
    };
    return specimenDetails;
  }
  throw new Error(`missing specimen details for specimen ${specimen.id}`);
};

export const taskIsBasedOnServiceRequest = (task: Task, serviceRequest: ServiceRequest): boolean => {
  return !!task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
};

export const provenanceIsTargetOfServiceRequest = (provenance: Provenance, serviceRequest: ServiceRequest): boolean => {
  return !!provenance.target?.some((target) => target.reference === `ServiceRequest/${serviceRequest.id}`);
};

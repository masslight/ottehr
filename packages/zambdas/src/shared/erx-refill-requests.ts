import Oystehr from '@oystehr/sdk';
import { MedicationRequest, Patient, Practitioner, Provenance, Task } from 'fhir/r4b';
import { ERX_REQUEST_TASK_INPUT_SYSTEM, SURESCRIPTS_MESSAGE_ID_SYSTEM } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFullName } from 'utils/lib/fhir/patient';
import { ErxPharmacyRefillRequest, GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { ERX_TASK, getTaskInputValue, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { makePrescribedMedicationDTO } from './chart-data';
import { createOwnerReference, createTask } from './tasks';

// The eRx service's renewal Task is the pharmacy's request; the Ottehr task, basedOn it, is what the Tasks page shows.

// A task nobody has completed, cancelled or refused yet
const OPEN_TASK_STATUSES: Task['status'][] = ['requested', 'received', 'accepted', 'ready', 'in-progress', 'on-hold'];

const isOpen = (task: Task): boolean => OPEN_TASK_STATUSES.includes(task.status);

/** One of what the pharmacy sent, from the eRx service's renewal Task. */
export const renewalInput = (renewalTask: Task, code: string): NonNullable<Task['input']>[number] | undefined =>
  renewalTask.input?.find((input) => getCoding(input.type, ERX_REQUEST_TASK_INPUT_SYSTEM)?.code === code);

/** What a change of the renewal Task means for its Ottehr task: one is made while the request is open, and it is
 * completed once the eRx service closes the request (answered, withdrawn or expired). */
export const refillRequestTaskAction = (renewalTask: Task, ottehrTasks: Task[]): 'create' | 'complete' | undefined => {
  if (!ottehrTasks.length) return isOpen(renewalTask) ? 'create' : undefined;
  return !isOpen(renewalTask) && ottehrTasks.some(isOpen) ? 'complete' : undefined;
};

export const refillRequestTitle = (renewalTask: Task, patientName: string): string => {
  const pharmacy = renewalInput(renewalTask, 'pharmacy-name')?.valueString ?? renewalTask.requester?.display;
  const medication = renewalInput(renewalTask, 'drug-description')?.valueString;
  return `Refill request${pharmacy ? ` from ${pharmacy}` : ''}: ${medication ?? 'prescription'} for ${patientName}`;
};

/** The Ottehr eRx task for a renewal Task: basedOn it, in the original prescription's visit, assigned to its owner
 * (the original prescriber). */
export const makeRefillRequestTask = (
  renewalTask: Task,
  patient: Patient | undefined,
  prescriber: Practitioner | undefined
): Task => {
  const task = createTask({
    category: ERX_TASK.category,
    title: refillRequestTitle(renewalTask, patient ? getFullName(patient) : 'unknown patient'),
    code: { system: ERX_TASK.system, code: ERX_TASK.code.refillRequest },
    encounterId: renewalTask.encounter?.reference?.split('/')[1],
    basedOn: [`Task/${renewalTask.id}`],
  });
  if (prescriber?.id) {
    task.status = 'in-progress';
    task.owner = createOwnerReference(prescriber.id, getFullName(prescriber));
  }
  return task;
};

/** Makes or completes the Ottehr task of a renewal Task (`refillRequestTaskAction`). */
export const syncRefillRequestTask = async (oystehr: Oystehr, renewalTask: Task): Promise<Task[]> => {
  const ottehrTasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'based-on', value: `Task/${renewalTask.id}` },
        { name: 'code', value: `${ERX_TASK.system}|${ERX_TASK.code.refillRequest}` },
      ],
    })
  ).unbundle();
  const action = refillRequestTaskAction(renewalTask, ottehrTasks);
  if (action === 'complete') {
    return Promise.all(
      ottehrTasks.filter(isOpen).map((task) =>
        oystehr.fhir.patch<Task>({
          resourceType: 'Task',
          id: task.id!,
          operations: [{ op: 'replace', path: '/status', value: 'completed' }],
        })
      )
    );
  }
  if (action !== 'create') return [];
  const [patient, prescriber] = await Promise.all([
    renewalTask.for?.reference?.startsWith('Patient/')
      ? oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: renewalTask.for.reference.split('/')[1] })
      : undefined,
    renewalTask.owner?.reference?.startsWith('Practitioner/')
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: renewalTask.owner.reference.split('/')[1] })
      : undefined,
  ]);
  return [await oystehr.fhir.create(makeRefillRequestTask(renewalTask, patient, prescriber))];
};

const messageId = (task: Task): string | undefined =>
  task.identifier?.find((identifier) => identifier.system === SURESCRIPTS_MESSAGE_ID_SYSTEM)?.value;

/**
 * The pharmacy's request from every version of its renewal Task, oldest first. Only what the pharmacy sent is kept: a
 * field it left out stays absent. When the pharmacy asks again the eRx service points the same Task at the newest
 * request (its Surescripts message id); the first version with that id is when it asked again. The service marks a
 * withdrawn request's Task cancelled.
 */
export const readPharmacyRefillRequest = (versions: Task[]): ErxPharmacyRefillRequest => {
  const first = versions[0];
  const latest = versions[versions.length - 1];
  const value = (code: string): NonNullable<Task['input']>[number] | undefined => renewalInput(latest, code);
  const newest = messageId(latest);
  const askedAgain =
    newest && messageId(first) !== newest
      ? versions.find((version) => messageId(version) === newest)?.meta?.lastUpdated
      : undefined;
  return {
    renewalTaskId: latest.id!,
    pharmacy: {
      name: value('pharmacy-name')?.valueString,
      ncpdpId: value('pharmacy-ncpdp-id')?.valueString,
      npi: value('pharmacy-npi')?.valueString,
      phone: value('pharmacy-phone')?.valueString,
    },
    medication: {
      description: value('drug-description')?.valueString,
      ndc: value('ndc')?.valueString,
      quantityValue: value('quantity')?.valueDecimal,
      quantityUnit: value('quantity-unit')?.valueString,
      daysSupply: value('days-supply')?.valueInteger,
      lastFillDate: value('last-fill-date')?.valueDate,
      writtenDate: value('written-date')?.valueDate,
      substitutionAllowed: value('substitution-allowed')?.valueBoolean,
      sig: value('sig')?.valueString,
      noteToPharmacy: value('note-to-pharmacy')?.valueString,
      requestedRefills: value('requested-refills')?.valueInteger,
    },
    received: first.authoredOn ?? first.meta?.lastUpdated,
    askedAgain,
    withdrawn: latest.status === 'cancelled',
    closed: !isOpen(latest),
  };
};

/** The request behind a refill request task: the pharmacy's (basedOn its renewal Task), or a patient's that staff
 * wrote down as a manual eRx task on a prescription. */
export const getErxRequest = async (oystehr: Oystehr, taskId: string): Promise<GetErxRequestResponse> => {
  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  const renewalTaskId = task.basedOn
    ?.find((reference) => reference.reference?.startsWith('Task/'))
    ?.reference?.split('/')[1];
  let pharmacyRequest: ErxPharmacyRefillRequest | undefined;
  let medicationRequestId: string | undefined;
  if (getCoding(task.code, ERX_TASK.system)?.code === ERX_TASK.code.refillRequest && renewalTaskId) {
    const versions = (await oystehr.fhir.history<Task>({ resourceType: 'Task', id: renewalTaskId }))
      .unbundle()
      .sort((a, b) => (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? ''));
    if (!versions.length) throw FHIR_RESOURCE_NOT_FOUND('Task');
    pharmacyRequest = readPharmacyRefillRequest(versions);
    medicationRequestId = versions[versions.length - 1].focus?.reference?.split('/')[1];
  } else if (task.groupIdentifier?.value === MANUAL_TASK.category.erx) {
    medicationRequestId = getTaskInputValue(task, MANUAL_TASK.input.orderId);
  }
  if (!medicationRequestId) throw INVALID_INPUT_ERROR(`Task ${taskId} is not a refill request`);

  const resources = (
    await oystehr.fhir.search<MedicationRequest | Patient | Practitioner | Provenance>({
      resourceType: 'MedicationRequest',
      params: [
        { name: '_id', value: medicationRequestId },
        { name: '_include', value: 'MedicationRequest:subject' },
        { name: '_include', value: 'MedicationRequest:requester' },
        { name: '_revinclude', value: 'Provenance:target' },
      ],
    })
  ).unbundle();
  const medicationRequest = resources.find(
    (resource): resource is MedicationRequest => resource.resourceType === 'MedicationRequest'
  );
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');
  if (!medicationRequest) throw FHIR_RESOURCE_NOT_FOUND('MedicationRequest');
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');
  const prescriber = resources.find((resource): resource is Practitioner => resource.resourceType === 'Practitioner');
  return {
    taskId,
    pharmacyRequest,
    patientRequest: pharmacyRequest
      ? undefined
      : {
          note: getTaskInputValue(task, MANUAL_TASK.input.details),
          takenBy: getTaskInputValue(task, MANUAL_TASK.input.providerName),
          taken: task.authoredOn,
        },
    prescription: makePrescribedMedicationDTO(
      medicationRequest,
      resources.filter((resource): resource is Provenance => resource.resourceType === 'Provenance')
    ),
    prescriberName: prescriber && getFullName(prescriber),
    patient,
  };
};

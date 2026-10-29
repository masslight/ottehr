import Oystehr from '@oystehr/sdk';
import { MedicationRequest, Patient, Practitioner, Provenance, Task } from 'fhir/r4b';
import {
  ERX_CHANGE_REQUEST_TASK_CODE,
  ERX_REQUEST_TASK_CODE_SYSTEM,
  ERX_REQUEST_TASK_INPUT_SYSTEM,
  SURESCRIPTS_MESSAGE_ID_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFullName } from 'utils/lib/fhir/patient';
import {
  CHANGE_REQUEST_KINDS,
  ErxPharmacyChangeRequest,
  ErxPharmacyRefillRequest,
  GetErxRequestResponse,
} from 'utils/lib/types/api/erx.types';
import { ERX_TASK, getTaskInputValue, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { makePrescribedMedicationDTO } from './chart-data';
import { createOwnerReference, createTask } from './tasks';

// The eRx service's renewal or change Task is the pharmacy's request; the Ottehr task, basedOn it, is what the Tasks page shows.

// A task nobody has completed, cancelled or refused yet
const OPEN_TASK_STATUSES: Task['status'][] = ['requested', 'received', 'accepted', 'ready', 'in-progress', 'on-hold'];

const isOpen = (task: Task): boolean => OPEN_TASK_STATUSES.includes(task.status);

/** One of what the pharmacy sent, from the eRx service's renewal or change Task. */
export const renewalInput = (renewalTask: Task, code: string): NonNullable<Task['input']>[number] | undefined =>
  renewalTask.input?.find((input) => getCoding(input.type, ERX_REQUEST_TASK_INPUT_SYSTEM)?.code === code);

/** What a change of the renewal or change Task means for its Ottehr task: one is made while the request is open, and it is
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

const isChangeTask = (requestTask: Task): boolean =>
  getCoding(requestTask.code, ERX_REQUEST_TASK_CODE_SYSTEM)?.code === ERX_CHANGE_REQUEST_TASK_CODE;

/** A change request names no medication, so its sentence names the original prescription's, and the kind of change. */
export const changeRequestTitle = (changeTask: Task, medication: string | undefined, patientName: string): string => {
  const pharmacy = renewalInput(changeTask, 'pharmacy-name')?.valueString ?? changeTask.requester?.display;
  const code = renewalInput(changeTask, 'change-code')?.valueString;
  const kind = code && (CHANGE_REQUEST_KINDS[code] ?? code);
  return `Change request${pharmacy ? ` from ${pharmacy}` : ''}: ${medication ?? 'prescription'} for ${patientName}${
    kind ? ` — ${kind}` : ''
  }`;
};

/** The Ottehr eRx task for a renewal or change Task: basedOn it, in the original prescription's visit, assigned to
 * its owner (the original prescriber). */
export const makeErxRequestTask = (
  requestTask: Task,
  patient: Patient | undefined,
  prescriber: Practitioner | undefined,
  original?: MedicationRequest
): Task => {
  const patientName = patient ? getFullName(patient) : 'unknown patient';
  const change = isChangeTask(requestTask);
  const task = createTask({
    category: ERX_TASK.category,
    title: change
      ? changeRequestTitle(
          requestTask,
          original?.medicationCodeableConcept?.coding?.[0]?.display ?? original?.medicationReference?.display,
          patientName
        )
      : refillRequestTitle(requestTask, patientName),
    code: { system: ERX_TASK.system, code: change ? ERX_TASK.code.changeRequest : ERX_TASK.code.refillRequest },
    encounterId: requestTask.encounter?.reference?.split('/')[1],
    basedOn: [`Task/${requestTask.id}`],
  });
  if (prescriber?.id) {
    task.status = 'in-progress';
    task.owner = createOwnerReference(prescriber.id, getFullName(prescriber));
  }
  return task;
};

/** Makes or completes the Ottehr task of a renewal or change Task (`refillRequestTaskAction`). */
export const syncErxRequestTask = async (oystehr: Oystehr, requestTask: Task): Promise<Task[]> => {
  const code = isChangeTask(requestTask) ? ERX_TASK.code.changeRequest : ERX_TASK.code.refillRequest;
  const ottehrTasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'based-on', value: `Task/${requestTask.id}` },
        { name: 'code', value: `${ERX_TASK.system}|${code}` },
      ],
    })
  ).unbundle();
  const action = refillRequestTaskAction(requestTask, ottehrTasks);
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
  const [patient, prescriber, original] = await Promise.all([
    requestTask.for?.reference?.startsWith('Patient/')
      ? oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: requestTask.for.reference.split('/')[1] })
      : undefined,
    requestTask.owner?.reference?.startsWith('Practitioner/')
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: requestTask.owner.reference.split('/')[1] })
      : undefined,
    // The medication a change request is about
    code === ERX_TASK.code.changeRequest && requestTask.focus?.reference?.startsWith('MedicationRequest/')
      ? oystehr.fhir.get<MedicationRequest>({
          resourceType: 'MedicationRequest',
          id: requestTask.focus.reference.split('/')[1],
        })
      : undefined,
  ]);
  return [await oystehr.fhir.create(makeErxRequestTask(requestTask, patient, prescriber, original))];
};

const messageId = (task: Task): string | undefined =>
  task.identifier?.find((identifier) => identifier.system === SURESCRIPTS_MESSAGE_ID_SYSTEM)?.value;

/**
 * What every pharmacy request has, from every version of its renewal or change Task, oldest first. When the pharmacy
 * asks again the eRx service points the same Task at the newest request (its Surescripts message id); the first
 * version with that id is when it asked again. The service marks a withdrawn request's Task cancelled.
 */
const readPharmacyRequest = (
  versions: Task[]
): Omit<ErxPharmacyChangeRequest, 'changeTaskId' | 'code' | 'subCodes' | 'suggestions'> => {
  const first = versions[0];
  const latest = versions[versions.length - 1];
  const value = (code: string): NonNullable<Task['input']>[number] | undefined => renewalInput(latest, code);
  const newest = messageId(latest);
  const askedAgain =
    newest && messageId(first) !== newest
      ? versions.find((version) => messageId(version) === newest)?.meta?.lastUpdated
      : undefined;
  return {
    pharmacy: {
      name: value('pharmacy-name')?.valueString,
      ncpdpId: value('pharmacy-ncpdp-id')?.valueString,
      npi: value('pharmacy-npi')?.valueString,
      phone: value('pharmacy-phone')?.valueString,
    },
    received: first.authoredOn ?? first.meta?.lastUpdated,
    askedAgain,
    withdrawn: latest.status === 'cancelled',
    closed: !isOpen(latest),
  };
};

/** The pharmacy's refill request (`readPharmacyRequest`). Only what the pharmacy sent is kept: a field it left out
 * stays absent. */
export const readPharmacyRefillRequest = (versions: Task[]): ErxPharmacyRefillRequest => {
  const latest = versions[versions.length - 1];
  const value = (code: string): NonNullable<Task['input']>[number] | undefined => renewalInput(latest, code);
  return {
    renewalTaskId: latest.id!,
    ...readPharmacyRequest(versions),
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
  };
};

/** A suggestion as the eRx service keeps it. `quantityUnit` (the NCPDP term, as on the renewal Task) is requested
 * from the eRx service; it keeps only the NCI code today. */
interface RequestedChangeMedication {
  description: string;
  ndc?: string;
  quantityValue?: number;
  quantityUnit?: string;
  daysSupply?: number;
  numberOfRefills?: number;
  substitutionAllowed?: boolean;
  sigText?: string;
  noteToPharmacy?: string;
}

/** The pharmacy's change request (`readPharmacyRequest`): its kind, its words and its suggestions, which the eRx
 * service keeps as JSON in one input. Only what the pharmacy sent is kept (S.207). */
export const readPharmacyChangeRequest = (versions: Task[]): ErxPharmacyChangeRequest => {
  const latest = versions[versions.length - 1];
  const value = (code: string): string | undefined => renewalInput(latest, code)?.valueString;
  const suggestions: RequestedChangeMedication[] = JSON.parse(value('requested-medications') ?? '[]');
  return {
    changeTaskId: latest.id!,
    ...readPharmacyRequest(versions),
    code: value('change-code') ?? '',
    subCodes: value('change-sub-codes')?.split(',') ?? [],
    reason: value('change-reason'),
    suggestions: suggestions.map((suggestion) => ({
      description: suggestion.description,
      ndc: suggestion.ndc,
      quantityValue: suggestion.quantityValue,
      quantityUnit: suggestion.quantityUnit,
      daysSupply: suggestion.daysSupply,
      numberOfRefills: suggestion.numberOfRefills,
      substitutionAllowed: suggestion.substitutionAllowed,
      sig: suggestion.sigText,
      noteToPharmacy: suggestion.noteToPharmacy,
    })),
  };
};

/** The request behind a refill or change request task: the pharmacy's (basedOn its renewal or change Task), or a
 * patient's that staff wrote down as a manual eRx task on a prescription. */
export const getErxRequest = async (oystehr: Oystehr, taskId: string): Promise<GetErxRequestResponse> => {
  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  const requestTaskId = task.basedOn
    ?.find((reference) => reference.reference?.startsWith('Task/'))
    ?.reference?.split('/')[1];
  let pharmacyRequest: ErxPharmacyRefillRequest | undefined;
  let pharmacyChangeRequest: ErxPharmacyChangeRequest | undefined;
  let medicationRequestId: string | undefined;
  const code = getCoding(task.code, ERX_TASK.system)?.code;
  const kind =
    code === ERX_TASK.code.refillRequest ? 'refill' : code === ERX_TASK.code.changeRequest ? 'change' : undefined;
  if (kind && requestTaskId) {
    const versions = (await oystehr.fhir.history<Task>({ resourceType: 'Task', id: requestTaskId }))
      .unbundle()
      .sort((a, b) => (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? ''));
    if (!versions.length) throw FHIR_RESOURCE_NOT_FOUND('Task');
    if (kind === 'refill') pharmacyRequest = readPharmacyRefillRequest(versions);
    else pharmacyChangeRequest = readPharmacyChangeRequest(versions);
    medicationRequestId = versions[versions.length - 1].focus?.reference?.split('/')[1];
  } else if (kind && task.groupIdentifier?.value === MANUAL_TASK.category.erx) {
    medicationRequestId = getTaskInputValue(task, MANUAL_TASK.input.orderId);
  }
  if (!kind || !medicationRequestId) throw INVALID_INPUT_ERROR(`Task ${taskId} is not a refill or change request`);

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
    kind,
    pharmacyRequest,
    pharmacyChangeRequest,
    patientRequest:
      pharmacyRequest || pharmacyChangeRequest
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

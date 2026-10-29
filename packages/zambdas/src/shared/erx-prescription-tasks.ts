import Oystehr, { SearchParam } from '@oystehr/sdk';
import { MedicationRequest, Patient, Practitioner, Provenance, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFullName } from 'utils/lib/fhir/patient';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { makePrescribedMedicationDTO, medicationRequestIdFromReference } from './chart-data';
import { createOwnerReference, createTask } from './tasks';

export type PrescriptionTaskCode =
  | typeof ERX_TASK.code.prescriptionError
  | typeof ERX_TASK.code.prescriptionUnconfirmed;

const PRESCRIPTION_TASK_CODES: string[] = [ERX_TASK.code.prescriptionError, ERX_TASK.code.prescriptionUnconfirmed];

// A task nobody has completed, cancelled or refused yet
const OPEN_TASK_STATUSES: Task['status'][] = ['requested', 'received', 'accepted', 'ready', 'in-progress', 'on-hold'];

// Surescripts asks to wait this long for a pharmacy's confirmation before following up by hand (Status 000)
export const NO_CONFIRMATION_HOURS = 24;

/** A prescription as the eRx table reads it, plus the ids of the prescriptions it replaces (`basedOn`). */
export type ErxPrescription = PrescribedMedicationDTO & { replaces: string[] };

const toErxPrescription = (medicationRequest: MedicationRequest, provenances: Provenance[]): ErxPrescription => ({
  ...makePrescribedMedicationDTO(medicationRequest, provenances),
  replaces: (medicationRequest.basedOn ?? [])
    .map((reference) => medicationRequestIdFromReference(reference.reference))
    .filter((id): id is string => !!id),
});

const taskCode = (task: Task): string | undefined => getCoding(task.code, ERX_TASK.system)?.code;

const isOpen = (task: Task): boolean => OPEN_TASK_STATUSES.includes(task.status);

/**
 * The task a prescription needs, if any. Nothing while any open task points at it. Otherwise an error task when
 * Surescripts stopped it (a faxed one isn't stopped and gets none), and a no-confirmation task when it is still
 * Sending 24 hours after it went out, faxed or not. Each is made once: one someone completed isn't made again.
 */
export const prescriptionTaskToCreate = (
  prescription: PrescribedMedicationDTO,
  tasks: Task[],
  now: DateTime
): PrescriptionTaskCode | undefined => {
  if (tasks.some(isOpen)) return undefined;
  const faxed = prescription.events?.some((event) => event.code === 'faxed');
  const sent = prescription.sent ? DateTime.fromISO(prescription.sent) : undefined;
  let code: PrescriptionTaskCode | undefined;
  if (prescription.status === 'stopped' && !faxed) code = ERX_TASK.code.prescriptionError;
  if (prescription.status === 'draft' && sent && now.diff(sent, 'hours').hours >= NO_CONFIRMATION_HOURS)
    code = ERX_TASK.code.prescriptionUnconfirmed;
  return code && !tasks.some((task) => taskCode(task) === code) ? code : undefined;
};

// The medication a prescription is for: its NDC, else the compound's or medication's name
const medicationKey = (prescription: PrescribedMedicationDTO): string | undefined =>
  prescription.order?.ndc ?? prescription.order?.compound?.description ?? prescription.name;

/**
 * Whether another prescription replaces this one: one approved from it (it is `basedOn` this one), or the same
 * medication sent again later in the same visit (Resend, Send to another pharmacy).
 */
export const isPrescriptionReplaced = (prescription: ErxPrescription, sameVisit: ErxPrescription[]): boolean =>
  sameVisit.some(
    (other) =>
      other.resourceId !== prescription.resourceId &&
      (other.replaces.includes(prescription.resourceId ?? '') ||
        (other.encounterId === prescription.encounterId &&
          medicationKey(other) !== undefined &&
          medicationKey(other) === medicationKey(prescription) &&
          (other.sent ?? '') > (prescription.sent ?? '')))
  );

/** Whether an error or no-confirmation task about the prescription is done: it went through, was cancelled, or was
 * replaced. */
export const isPrescriptionSettled = (prescription: ErxPrescription, sameVisit: ErxPrescription[]): boolean =>
  prescription.status === 'active' ||
  prescription.status === 'cancelled' ||
  isPrescriptionReplaced(prescription, sameVisit);

const ERROR_TEXT_PREFIX = 'Surescripts reported an error:';

export const prescriptionTaskTitle = (
  code: PrescriptionTaskCode,
  prescription: PrescribedMedicationDTO,
  patientName: string
): string => {
  const medication = `${prescription.name ?? 'prescription'} for ${patientName}`;
  if (code === ERX_TASK.code.prescriptionUnconfirmed)
    return `No confirmation from ${
      prescription.pharmacyName ?? 'the pharmacy'
    } after ${NO_CONFIRMATION_HOURS} hours — call the pharmacy to confirm ${medication}`;
  const errorText = prescription.events?.filter((event) => event.code.startsWith('error')).at(-1)?.text;
  const reason = errorText?.startsWith(ERROR_TEXT_PREFIX)
    ? errorText.slice(ERROR_TEXT_PREFIX.length).trim()
    : errorText;
  return `Prescription failed: ${medication}${reason ? ` — ${reason}` : ''}`;
};

/** The eRx task for a prescription: assigned to its prescriber, pointing at it (focus) and its visit. */
const makePrescriptionTask = (
  code: PrescriptionTaskCode,
  prescription: PrescribedMedicationDTO,
  patient: Patient | undefined,
  prescriber: Practitioner | undefined
): Task => {
  const task = createTask({
    category: ERX_TASK.category,
    title: prescriptionTaskTitle(code, prescription, patient ? getFullName(patient) : 'unknown patient'),
    code: { system: ERX_TASK.system, code },
    encounterId: prescription.encounterId,
  });
  task.focus = { reference: `MedicationRequest/${prescription.resourceId}` };
  if (prescriber?.id) {
    task.status = 'in-progress';
    task.owner = createOwnerReference(prescriber.id, getFullName(prescriber));
  }
  return task;
};

/**
 * Creates the tasks the eRx prescriptions matching the search need (`prescriptionTaskToCreate`). Each comes with its
 * patient, prescriber, events and the tasks pointing at it.
 */
export const createPrescriptionTasks = async (
  oystehr: Oystehr,
  params: SearchParam[],
  now = DateTime.now()
): Promise<Task[]> => {
  const resources = await getAllFhirSearchPages<MedicationRequest | Patient | Practitioner | Provenance | Task>(
    {
      resourceType: 'MedicationRequest',
      params: [
        ...params,
        { name: '_include', value: 'MedicationRequest:subject' },
        { name: '_include', value: 'MedicationRequest:requester' },
        { name: '_revinclude', value: 'Provenance:target' },
        { name: '_revinclude', value: 'Task:focus' },
      ],
    },
    oystehr
  );
  const provenances = resources.filter((resource): resource is Provenance => resource.resourceType === 'Provenance');
  const tasks = resources.filter((resource): resource is Task => resource.resourceType === 'Task');
  const created: Task[] = [];
  for (const medicationRequest of resources) {
    if (medicationRequest.resourceType !== 'MedicationRequest') continue;
    const prescription = makePrescribedMedicationDTO(medicationRequest, provenances);
    const focused = tasks.filter(
      (task) => medicationRequestIdFromReference(task.focus?.reference) === medicationRequest.id
    );
    const code = prescriptionTaskToCreate(prescription, focused, now);
    if (!code) continue;
    const patient = resources.find(
      (resource): resource is Patient =>
        resource.resourceType === 'Patient' && `Patient/${resource.id}` === medicationRequest.subject?.reference
    );
    const prescriber = resources.find(
      (resource): resource is Practitioner =>
        resource.resourceType === 'Practitioner' &&
        `Practitioner/${resource.id}` === medicationRequest.requester?.reference
    );
    created.push(await oystehr.fhir.create(makePrescriptionTask(code, prescription, patient, prescriber)));
  }
  return created;
};

/** Completes the open error and no-confirmation tasks whose prescription is settled (`isPrescriptionSettled`). */
export const completeSettledPrescriptionTasks = async (oystehr: Oystehr): Promise<Task[]> => {
  const openTasks = await getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        { name: 'code', value: PRESCRIPTION_TASK_CODES.map((code) => `${ERX_TASK.system}|${code}`).join(',') },
        { name: 'status', value: OPEN_TASK_STATUSES.join(',') },
      ],
    },
    oystehr
  );
  const encounters = [...new Set(openTasks.flatMap((task) => task.encounter?.reference ?? []))];
  if (!encounters.length) return [];
  // Every eRx prescription of those visits: the ones the tasks point at, and any that replace them.
  const resources = await getAllFhirSearchPages<MedicationRequest | Provenance>(
    {
      resourceType: 'MedicationRequest',
      params: [
        { name: 'encounter', value: encounters.join(',') },
        { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
        { name: '_revinclude', value: 'Provenance:target' },
      ],
    },
    oystehr
  );
  const provenances = resources.filter((resource): resource is Provenance => resource.resourceType === 'Provenance');
  const prescriptions = resources
    .filter((resource): resource is MedicationRequest => resource.resourceType === 'MedicationRequest')
    .map((medicationRequest) => toErxPrescription(medicationRequest, provenances));
  const settled = openTasks.filter((task) => {
    const prescription = prescriptions.find(
      (candidate) => candidate.resourceId === medicationRequestIdFromReference(task.focus?.reference)
    );
    return prescription !== undefined && isPrescriptionSettled(prescription, prescriptions);
  });
  return Promise.all(
    settled.map((task) =>
      oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [{ op: 'replace', path: '/status', value: 'completed' }],
      })
    )
  );
};

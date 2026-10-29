import Oystehr, { SearchParam } from '@oystehr/sdk';
import { MedicationRequest, Patient, Practitioner, Provenance, Task } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFullName } from 'utils/lib/fhir/patient';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
import { makePrescribedMedicationDTO, medicationRequestIdFromReference } from './chart-data';
import { createOwnerReference, createTask } from './tasks';

export type PrescriptionTaskCode = typeof ERX_TASK.code.prescriptionError;

// A task nobody has completed, cancelled or refused yet
const OPEN_TASK_STATUSES: Task['status'][] = ['requested', 'received', 'accepted', 'ready', 'in-progress', 'on-hold'];

const taskCode = (task: Task): string | undefined => getCoding(task.code, ERX_TASK.system)?.code;

const isOpen = (task: Task): boolean => OPEN_TASK_STATUSES.includes(task.status);

/**
 * The task a prescription needs, if any. Nothing while any open task points at it. Otherwise an error task when
 * Surescripts stopped it (a faxed one isn't stopped and gets none). Each is made once: one someone completed isn't
 * made again.
 */
export const prescriptionTaskToCreate = (
  prescription: PrescribedMedicationDTO,
  tasks: Task[]
): PrescriptionTaskCode | undefined => {
  if (tasks.some(isOpen)) return undefined;
  const faxed = prescription.events?.some((event) => event.code === 'faxed');
  let code: PrescriptionTaskCode | undefined;
  if (prescription.status === 'stopped' && !faxed) code = ERX_TASK.code.prescriptionError;
  return code && !tasks.some((task) => taskCode(task) === code) ? code : undefined;
};

const ERROR_TEXT_PREFIX = 'Surescripts reported an error:';

export const prescriptionTaskTitle = (
  code: PrescriptionTaskCode,
  prescription: PrescribedMedicationDTO,
  patientName: string
): string => {
  const medication = `${prescription.name ?? 'prescription'} for ${patientName}`;
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
export const createPrescriptionTasks = async (oystehr: Oystehr, params: SearchParam[]): Promise<Task[]> => {
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
    const code = prescriptionTaskToCreate(prescription, focused);
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

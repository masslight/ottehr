import Oystehr from '@oystehr/sdk';
import { Patient, Practitioner, Task } from 'fhir/r4b';
import { ERX_REQUEST_TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFullName } from 'utils/lib/fhir/patient';
import { ERX_TASK } from 'utils/lib/types/data/tasks/types';
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

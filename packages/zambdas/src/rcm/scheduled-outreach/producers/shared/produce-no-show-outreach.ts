import Oystehr from '@oystehr/sdk';
import { Encounter, Task } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { OUTREACH_TASK_TAG_SYSTEM, OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceNoShowOutreachParams {
  /** Encounter ID of the visit that was marked No Show */
  encounterId: string;
  oystehr: Oystehr;
}

/**
 * Creates outreach tasks triggered by a visit being marked No Show.
 *
 * The event timestamp is the moment the visit was marked, so a "0 minutes after" action
 * goes out on the next promoter pass. Templates resolve {{visit-date}} and {{location}}
 * from the Encounter focus, which is how the missed-appointment message names the visit.
 */
export async function produceNoShowOutreach(params: ProduceNoShowOutreachParams): Promise<OutreachTaskResult> {
  const { encounterId, oystehr } = params;

  let encounter: Encounter;
  try {
    encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });
  } catch {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Encounter ${encounterId} could not be found`);
  }

  if (!encounter.subject?.reference) {
    throw INVALID_INPUT_ERROR(`Encounter ${encounter.id} has no subject (patient) reference`);
  }

  const appointmentRef = encounter.appointment?.[0]?.reference
    ? { reference: encounter.appointment[0].reference }
    : undefined;

  return produceOutreachTasks({
    triggerEvent: 'no-show',
    patient: encounter.subject,
    focus: { reference: `Encounter/${encounter.id}` },
    appointment: appointmentRef,
    eventTimestamp: new Date().toISOString(),
    oystehr,
  });
}

/**
 * Cancels no-show outreach that has not gone out yet, for a visit that was returned to Arrived
 * because the patient showed up late. Tasks already in progress or completed are left alone.
 */
export async function cancelPendingNoShowOutreach(params: ProduceNoShowOutreachParams): Promise<Task[]> {
  const { encounterId, oystehr } = params;

  const pending = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'focus', value: `Encounter/${encounterId}` },
        { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|no-show` },
        { name: 'status', value: 'draft,requested' },
      ],
    })
  ).unbundle();

  return Promise.all(
    pending.map((task) =>
      oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: 'Visit returned to Arrived' } },
        ],
      })
    )
  );
}

import { Coding, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrCodeSystemUrl, ottehrIdentifierSystem, undefinedIfEmptyArray } from 'utils';

export const TASK_TYPE_SYSTEM = ottehrCodeSystemUrl('task-type');
const TASK_LOCATION_SYSTEM = ottehrCodeSystemUrl('task-location');

export function createTask(data: {
  category: string;
  type: string;
  encounterId: string;
  locationId?: string;
  input?: { type: string; value?: string }[];
}): Task {
  const tag: Coding[] = [
    {
      code: 'task',
    },
  ];
  if (data.locationId != null) {
    tag.push({
      system: TASK_LOCATION_SYSTEM,
      code: data.locationId,
    });
  }
  return {
    resourceType: 'Task',
    status: 'requested',
    groupIdentifier: {
      system: ottehrIdentifierSystem('task-category'),
      value: data.category,
    },
    code: {
      coding: [
        {
          system: TASK_TYPE_SYSTEM,
          code: data.type,
        },
      ],
    },
    encounter: { reference: `Encounter/${data.encounterId}` },
    authoredOn: DateTime.now().toISO(),
    intent: 'order',
    input: undefinedIfEmptyArray(
      (data.input ?? [])
        .map((input) => {
          return {
            type: {
              coding: [
                {
                  system: ottehrCodeSystemUrl('task-input'),
                  code: input.type,
                },
              ],
            },
            valueString: input.value,
          };
        })
        .filter((input) => input.valueString != null)
    ),
    meta: {
      tag,
    },
  };
}

export function getTaskLocationId(task: Task): string | undefined {
  return task.meta?.tag?.find((coding) => coding.system === TASK_LOCATION_SYSTEM)?.code;
}

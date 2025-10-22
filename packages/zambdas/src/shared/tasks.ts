import { Coding, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrCodeSystemUrl, ottehrIdentifierSystem, undefinedIfEmptyArray } from 'utils';

export const TASK_TYPE_SYSTEM = ottehrCodeSystemUrl('task-type');
const TASK_LOCATION_SYSTEM = ottehrCodeSystemUrl('task-location');

export function createTask(data: {
  category: string;
  code: {
    system: string;
    code: string;
  };
  encounterId: string;
  locationId?: string;
  input?: { type: string; value?: string }[] | TaskInput[];
  basedOn?: string;
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
    status: 'ready',
    groupIdentifier: {
      system: ottehrIdentifierSystem('task-category'),
      value: data.category,
    },
    code: {
      coding: [
        {
          system: data.code.system,
          code: data.code.code,
        },
      ],
    },
    encounter: { reference: `Encounter/${data.encounterId}` },
    authoredOn: DateTime.now().toISO(),
    intent: 'order',
    basedOn: data.basedOn
      ? [
          {
            reference: data.basedOn,
          },
        ]
      : undefined,
    input: undefinedIfEmptyArray(
      (data.input ?? [])
        .map((input) => {
          if (isTaskInput(input)) {
            return input;
          }
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

function isTaskInput(input: { type: string; value?: string } | TaskInput): input is TaskInput {
  return typeof input.type === 'object';
}

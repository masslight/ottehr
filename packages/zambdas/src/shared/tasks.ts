import { CodeableConcept, Coding, Reference, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { undefinedIfEmptyArray } from 'utils';
import { ottehrCodeSystemUrl, ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';

export const TASK_TYPE_SYSTEM = ottehrCodeSystemUrl('task-type');
const TASK_LOCATION_SYSTEM = ottehrCodeSystemUrl('task-location');

export function createTask(data: {
  category: string;
  code?:
    | {
        system: string;
        code: string;
      }
    | CodeableConcept;
  encounterId?: string;
  location?: {
    id: string;
    name?: string;
  };
  input?: { type: string; valueString?: string; valueReference?: Reference }[] | TaskInput[];
  basedOn?: string[];
}): Task {
  const tag: Coding[] = [
    {
      code: 'task',
    },
  ];
  if (data.location != null) {
    tag.push({
      system: TASK_LOCATION_SYSTEM,
      code: data.location.id,
      display: data.location?.name,
    });
  }
  return {
    resourceType: 'Task',
    status: 'ready',
    groupIdentifier: {
      system: ottehrIdentifierSystem('task-category'),
      value: data.category,
    },
    code: data.code
      ? isCodeableConcept(data.code)
        ? data.code
        : {
            coding: [
              {
                system: data.code.system,
                code: data.code.code,
              },
            ],
          }
      : undefined,
    encounter: data.encounterId ? { reference: `Encounter/${data.encounterId}` } : undefined,
    authoredOn: DateTime.now().toISO(),
    intent: 'order',
    basedOn: data.basedOn
      ? data.basedOn.map((basedOn) => {
          return {
            reference: basedOn,
          };
        })
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
            valueString: input.valueString,
            valueReference: input.valueReference,
          };
        })
        .filter((input) => input.valueString || input.valueReference)
    ),
    location: data.location
      ? {
          reference: 'Location/' + data.location.id,
          display: data.location.name,
        }
      : undefined,
    meta: {
      tag,
    },
  };
}

export function getTaskLocation(task: Task): { id: string; name?: string } | undefined {
  const locationCoding = task.meta?.tag?.find((coding) => coding.system === TASK_LOCATION_SYSTEM);
  if (locationCoding?.code) {
    return {
      id: locationCoding.code,
      name: locationCoding.display,
    };
  }
  return undefined;
}

function isTaskInput(input: { type: string; value?: string } | TaskInput): input is TaskInput {
  return typeof input.type === 'object';
}

function isCodeableConcept(
  code:
    | {
        system: string;
        code: string;
      }
    | CodeableConcept
): code is CodeableConcept {
  return (code as CodeableConcept).coding != null;
}

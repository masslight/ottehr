import { Task } from 'fhir/r4b';
import { EXPORT_CLAIMS_FILTERS_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/subscriptions/task/sub-export-billing-claims-csv/validateRequestParameters';
import { TaskSubscriptionInput } from '../../../src/subscriptions/task/validateRequestParameters';
import { createMockSecrets } from './helpers';

const secrets = createMockSecrets();

const taskFor = (task: Partial<Task>): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    ...task,
  }) as Task;

const inputFor = (task: Partial<Task>): TaskSubscriptionInput => ({
  task: taskFor(task),
  secrets,
});

const carrying = (valueString: string): Partial<Task> => ({
  input: [
    {
      type: {
        coding: [
          {
            code: EXPORT_CLAIMS_FILTERS_CODE,
          },
        ],
      },
      valueString,
    },
  ],
});

const thrownBy = (call: () => unknown): unknown => {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('sub-export-billing-claims-csv - validateRequestParameters', () => {
  it('reads back the filters the kick-off zambda wrote', () => {
    const filters = {
      searchText: 'Smith',
      status: 'denied',
      payerId: 'P1',
    };

    expect(validateRequestParameters(inputFor(carrying(JSON.stringify(filters))))).toEqual({
      ...filters,
      taskId: 'task-1',
      secrets,
    });
  });

  it('treats a Task with no filters as an export of everything', () => {
    expect(validateRequestParameters(inputFor({}))).toEqual({
      taskId: 'task-1',
      secrets,
    });
  });

  it('drops paging parameters', () => {
    expect(
      validateRequestParameters(
        inputFor(
          carrying(
            JSON.stringify({
              status: 'denied',
              offset: 25,
              pageSize: 25,
            })
          )
        )
      )
    ).toEqual({
      status: 'denied',
      taskId: 'task-1',
      secrets,
    });
  });

  it('exports everything when the filters are not ones the claims list accepts', () => {
    expect(validateRequestParameters(inputFor(carrying(JSON.stringify({ type: 'dental' }))))).toEqual({
      taskId: 'task-1',
      secrets,
    });
  });

  it('exports everything when the payload is not the filter object', () => {
    expect(validateRequestParameters(inputFor(carrying('not json')))).toEqual({
      taskId: 'task-1',
      secrets,
    });
  });

  it('throws without a task', () => {
    expect(thrownBy(() => validateRequestParameters({ secrets } as TaskSubscriptionInput))).toBe(MISSING_REQUEST_BODY);
  });

  it('throws without secrets', () => {
    expect(thrownBy(() => validateRequestParameters({ task: taskFor({}) } as TaskSubscriptionInput))).toBe(
      MISSING_REQUEST_SECRETS
    );
  });

  it('throws when the task has no id to write the export back to', () => {
    expect(() => validateRequestParameters(inputFor({ id: undefined }))).toThrow('Task id is not found');
  });
});

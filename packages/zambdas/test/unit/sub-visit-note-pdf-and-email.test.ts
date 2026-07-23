import { Task } from 'fhir/r4b';
import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM } from 'utils';
import { describe, expect, it } from 'vitest';
import {
  resolveSkipEmail,
  shouldGenerateVisitDetailsPdf,
} from '../../src/subscriptions/task/sub-visit-note-pdf-and-email/index';

const skipEmailInput: Task['input'] = [
  {
    type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.SKIP_EMAIL }] },
    valueString: 'true',
  },
];

const buildTask = (overrides?: Partial<Task>): Task => ({
  resourceType: 'Task',
  status: 'requested',
  intent: 'order',
  ...overrides,
});

describe('resolveSkipEmail', () => {
  it('returns true when SKIP_EMAIL input is present with valueString "true"', () => {
    expect(resolveSkipEmail(buildTask({ input: skipEmailInput }))).toBe(true);
  });

  it('returns false when task has no input array', () => {
    expect(resolveSkipEmail(buildTask())).toBe(false);
  });

  it('returns false when input array is empty', () => {
    expect(resolveSkipEmail(buildTask({ input: [] }))).toBe(false);
  });

  it('returns false when valueString is not "true"', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.SKIP_EMAIL }] },
          valueString: 'false',
        },
      ],
    });
    expect(resolveSkipEmail(task)).toBe(false);
  });

  it('returns false when the coding system does not match', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: 'some-other-system', code: TASK_INPUT_TYPE_CODES.SKIP_EMAIL }] },
          valueString: 'true',
        },
      ],
    });
    expect(resolveSkipEmail(task)).toBe(false);
  });

  it('returns false when the coding code does not match', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: 'page-index' }] },
          valueString: 'true',
        },
      ],
    });
    expect(resolveSkipEmail(task)).toBe(false);
  });

  it('returns false when the input has no coding array', () => {
    const task = buildTask({
      input: [{ type: { text: 'skip-email' }, valueString: 'true' }],
    });
    expect(resolveSkipEmail(task)).toBe(false);
  });

  it('returns true when SKIP_EMAIL input is among multiple inputs', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }] },
          valueUnsignedInt: 1,
        },
        ...skipEmailInput,
      ],
    });
    expect(resolveSkipEmail(task)).toBe(true);
  });
});

describe('shouldGenerateVisitDetailsPdf', () => {
  it('generates on a fresh sign (no SKIP_EMAIL input)', () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask())).toBe(true);
  });

  it('skips on an addendum re-generation (SKIP_EMAIL input present)', () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask({ input: skipEmailInput }))).toBe(false);
  });

  it('generates when a SKIP_EMAIL-shaped input is not actually set to "true"', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.SKIP_EMAIL }] },
          valueString: 'false',
        },
      ],
    });
    expect(shouldGenerateVisitDetailsPdf(task)).toBe(true);
  });
});

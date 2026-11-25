import { Encounter, Task } from 'fhir/r4b';
import { FOLLOWUP_SUBTYPE_SYSTEM, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM } from 'utils/lib/types/common';
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
  const mainEncounter: Encounter = {
    resourceType: 'Encounter',
    id: 'main-enc',
    status: 'finished',
    class: { code: 'AMB' },
  };
  const followUpEncounter = (subtype: 'scheduled' | 'annotation'): Encounter => ({
    resourceType: 'Encounter',
    id: `follow-up-enc-${subtype}`,
    status: 'finished',
    class: { code: 'ACUTE' },
    partOf: { reference: 'Encounter/main-enc' },
    type: [
      {
        coding: [
          { system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code },
          ...(subtype === 'scheduled' ? [{ system: FOLLOWUP_SUBTYPE_SYSTEM, code: 'scheduled' }] : []),
        ],
      },
    ],
  });

  it('generates on a fresh sign (no SKIP_EMAIL input)', () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask(), mainEncounter)).toBe(true);
  });

  it('skips on an addendum re-generation (SKIP_EMAIL input present)', () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask({ input: skipEmailInput }), mainEncounter)).toBe(false);
  });

  it("skips when a follow-up note on the visit is signed, keeping the visit's signing-time copy", () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask(), followUpEncounter('annotation'))).toBe(false);
  });

  it('generates when a scheduled follow-up visit is signed', () => {
    expect(shouldGenerateVisitDetailsPdf(buildTask(), followUpEncounter('scheduled'))).toBe(true);
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
    expect(shouldGenerateVisitDetailsPdf(task, mainEncounter)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createTask } from '../../src/shared/tasks';

describe('createTask', () => {
  it('drops inputs whose valueString is blank, which FHIR rejects as an empty string', () => {
    const task = createTask({
      category: 'manual-other',
      title: 'Call back',
      input: [
        { type: 'title', valueString: 'Call back' },
        { type: 'details', valueString: ' \n ' },
        { type: 'order-id', valueString: '' },
        { type: 'patient', valueReference: { reference: 'Patient/p-1' } },
      ],
    });

    expect(task.input?.map((input) => input.type.coding?.[0].code)).toEqual(['title', 'patient']);
  });

  it('omits input entirely when every value is blank', () => {
    const task = createTask({
      category: 'manual-other',
      title: 'Call back',
      input: [{ type: 'details', valueString: ' ' }],
    });

    expect(task.input).toBeUndefined();
  });
});

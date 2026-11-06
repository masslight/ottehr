import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../src/ehr/tasks/create-manual-task';
import { ZambdaInput } from '../src/shared/types/common';

const zambdaInput = (body: unknown): ZambdaInput => ({ body: JSON.stringify(body), secrets: null }) as ZambdaInput;

const TASK = {
  category: MANUAL_TASK.category.erx,
  taskTitle: 'Refill',
  location: { id: 'location-1', name: 'Clinic' },
};

describe('create-manual-task: a refill or change request', () => {
  it.each(['refillRequest', 'changeRequest'])('%s needs a prescription', (flag) => {
    expect(() => validateRequestParameters(zambdaInput({ ...TASK, [flag]: true }))).toThrow(
      'A refill or change request needs a prescription'
    );
    expect(validateRequestParameters(zambdaInput({ ...TASK, [flag]: true, orderId: 'rx-1' }))).toMatchObject({
      orderId: 'rx-1',
      [flag]: true,
    });
  });

  it('an eRx task that isn’t a request needs none', () => {
    expect(validateRequestParameters(zambdaInput(TASK))).toMatchObject({ refillRequest: false, changeRequest: false });
  });
});

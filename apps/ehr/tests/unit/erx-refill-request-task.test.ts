import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ERX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask, GO_TO_REQUEST } from '../../src/features/visits/in-person/hooks/useTasks';

const TITLE = 'Refill request from CVS Pharmacy #7741: Lisinopril 10 mg tablet for Maria Lopez';

const task = (category: string, extra: Partial<FhirTask>): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  groupIdentifier: { system: ottehrIdentifierSystem('task-category'), value: category },
  ...extra,
});

describe('Tasks page: refill requests', () => {
  it('shows a pharmacy’s request by its sentence, with Go to request', () => {
    const row = fhirTaskToTask(
      task(ERX_TASK.category, {
        description: TITLE,
        code: { coding: [{ system: ERX_TASK.system, code: ERX_TASK.code.refillRequest }] },
        basedOn: [{ reference: 'Task/renewal-1' }],
      })
    );
    expect(row.title).toBe(TITLE);
    expect(row.action?.name).toBe(GO_TO_REQUEST);
    expect(row.completable).toBe(true);
  });

  it('gives a manual eRx task made as a refill request Go to request, and an ordinary one none', () => {
    const input = (code: string, valueString: string): NonNullable<FhirTask['input']>[number] => ({
      type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
      valueString,
    });
    const manual = (extra: Partial<FhirTask>): FhirTask =>
      task(MANUAL_TASK.category.erx, {
        input: [
          input(MANUAL_TASK.input.title, 'Refill request'),
          input(MANUAL_TASK.input.orderId, 'rx-1'),
          input(MANUAL_TASK.input.appointmentId, 'appointment-1'),
        ],
        ...extra,
      });
    const refill = { code: { coding: [{ system: ERX_TASK.system, code: ERX_TASK.code.refillRequest }] } };
    expect(fhirTaskToTask(manual(refill)).action?.name).toBe(GO_TO_REQUEST);
    expect(fhirTaskToTask(manual({})).action?.name).not.toBe(GO_TO_REQUEST);
    const change = { code: { coding: [{ system: ERX_TASK.system, code: ERX_TASK.code.changeRequest }] } };
    expect(fhirTaskToTask(manual(change)).action?.name).toBe(GO_TO_REQUEST);
  });

  it('shows a pharmacy’s change request by its sentence, with Go to request', () => {
    const title = 'Change request from CVS Pharmacy #7741: Dexilant 30 mg capsule for Maria Lopez — Out of stock';
    const row = fhirTaskToTask(
      task(ERX_TASK.category, {
        description: title,
        code: { coding: [{ system: ERX_TASK.system, code: ERX_TASK.code.changeRequest }] },
        basedOn: [{ reference: 'Task/change-1' }],
      })
    );
    expect(row.title).toBe(title);
    expect(row.action?.name).toBe(GO_TO_REQUEST);
  });
});

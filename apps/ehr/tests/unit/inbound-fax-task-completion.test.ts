import Oystehr from '@oystehr/sdk';
import { Task as FhirTask } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import {
  completeTaskVersionChecked,
  fhirTaskToTask,
  VIEW_FAX,
} from '../../src/features/visits/in-person/hooks/useTasks';

const DELETING = { coding: [{ system: 'inbound-fax-task', code: 'deleting' }] };
const FILED = { coding: [{ system: 'inbound-fax-task', code: 'filed' }] };

const makeFaxTask = (overrides: Partial<FhirTask> = {}): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  meta: { versionId: '7' },
  groupIdentifier: { value: 'inbound-fax' },
  code: { coding: [{ system: 'inbound-fax-task', code: 'match-inbound-fax' }] },
  input: [{ type: { coding: [{ system: TASK_INPUT_SYSTEM, code: 'communication-id' }] }, valueString: 'comm-1' }],
  ...overrides,
});

const makeOystehr = (task: FhirTask): { oystehr: Oystehr; transaction: ReturnType<typeof vi.fn> } => {
  const transaction = vi.fn().mockResolvedValue({});
  const oystehr = { fhir: { get: vi.fn().mockResolvedValue(task), transaction } } as unknown as Oystehr;
  return { oystehr, transaction };
};

describe('inbound fax task completion', () => {
  it('is not offered for a fax a delete has reserved, but is for open and filed faxes', () => {
    expect(fhirTaskToTask(makeFaxTask({ businessStatus: DELETING })).completable).toBe(false);
    expect(fhirTaskToTask(makeFaxTask()).completable).toBe(true);
    const filed = fhirTaskToTask(makeFaxTask({ businessStatus: FILED }));
    expect(filed.completable).toBe(true);
    expect(filed.action?.name).toBe(VIEW_FAX);
  });

  it('refuses to complete a fax reserved for deletion (a stale Complete button)', async () => {
    const { oystehr, transaction } = makeOystehr(makeFaxTask({ businessStatus: DELETING }));

    await expect(completeTaskVersionChecked(oystehr, { taskId: 'task-1' })).rejects.toThrow(/being deleted/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('completes against the version it read, with ifMatch in the transaction body (no If-Match header)', async () => {
    const { oystehr, transaction } = makeOystehr(makeFaxTask());

    await completeTaskVersionChecked(oystehr, { taskId: 'task-1' });

    const [patchRequest] = transaction.mock.calls[0][0].requests;
    expect(patchRequest).toMatchObject({ method: 'PATCH', url: '/Task/task-1', ifMatch: 'W/"7"' });
    expect(JSON.parse(atob(patchRequest.resource.data))).toEqual([
      { op: 'replace', path: '/status', value: 'completed' },
    ]);
  });

  it('fails when a delete reserves the fax while it is being completed', async () => {
    const { oystehr, transaction } = makeOystehr(makeFaxTask());
    transaction.mockRejectedValue(
      new Oystehr.OystehrFHIRError({ code: 412, error: { resourceType: 'OperationOutcome', issue: [] } })
    );

    await expect(completeTaskVersionChecked(oystehr, { taskId: 'task-1' })).rejects.toThrow(/changed by someone else/);
  });
});

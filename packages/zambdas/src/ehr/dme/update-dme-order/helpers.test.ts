import { BatchInputRequest } from '@oystehr/sdk';
import { DeviceRequest, FhirResource, Procedure, Task } from 'fhir/r4b';
import { DME_DISPENSED_EXTENSION_URL, DME_TASK, DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { describe, expect, it } from 'vitest';
import { getDmeDispensed, makeDmeDeviceRequest } from '../../../shared/dme';
import { createTask } from '../../../shared/tasks';
import {
  DmeOrderResources,
  makeDeleteRequests,
  makeDispenseRequests,
  makeEditRequests,
  needsNewDispenseTask,
} from './helpers';

const PRACTITIONER_ID = '11111111-1111-4111-8111-111111111111';
const DR_ID = '22222222-2222-4222-8222-222222222222';

const fields = (overrides: Record<string, unknown> = {}): ReturnType<typeof DmeOrderFieldsSchema.parse> =>
  DmeOrderFieldsSchema.parse({
    itemName: 'Knee brace',
    quantity: 2,
    billingCodes: [{ code: 'L1820', display: 'Knee orthosis' }],
    laterality: 'LT',
    modifier: 'NU',
    orderedByPractitionerId: PRACTITIONER_ID,
    ...overrides,
  });

const makeOrder = (overrides: Partial<DeviceRequest> = {}, external = false): DeviceRequest => ({
  ...makeDmeDeviceRequest({ fields: fields({ external }), encounterId: 'enc-1', patientId: 'pat-1' }),
  id: DR_ID,
  meta: { versionId: '3' },
  ...overrides,
});

const dispenseTask = (id: string, status: Task['status']): Task => ({
  ...createTask({
    category: DME_TASK.category,
    title: 'Dispense Knee brace',
    code: { system: DME_TASK.system, code: DME_TASK.code.dispense },
    basedOn: [`DeviceRequest/${DR_ID}`],
    input: [{ type: DME_TASK.input.itemName, valueString: 'Knee brace' }],
  }),
  id,
  status,
});

const billingProcedure: Procedure = { resourceType: 'Procedure', id: 'proc-1', status: 'completed', subject: {} };

const resources = (overrides: Partial<DmeOrderResources> = {}): DmeOrderResources => ({
  deviceRequest: makeOrder(),
  procedures: [billingProcedure],
  tasks: [dispenseTask('task-open', 'ready'), dispenseTask('task-done', 'completed')],
  ...overrides,
});

const decodePatch = (request: BatchInputRequest<FhirResource>): unknown =>
  JSON.parse(Buffer.from((request as any).resource.data, 'base64').toString());

const byMethod = (requests: BatchInputRequest<FhirResource>[], method: string): BatchInputRequest<FhirResource>[] =>
  requests.filter((r) => r.method === method);

describe('update-dme-order request builders', () => {
  it('edit re-syncs billing procedures and refreshes the open dispense task', () => {
    const requests = makeEditRequests({
      resources: resources(),
      fields: fields({ itemName: 'Ankle brace', quantity: 3 }),
      providerName: 'Jane Doe, MD',
    });

    const [putDr, ...rest] = requests;
    expect(putDr).toMatchObject({ method: 'PUT', url: `/DeviceRequest/${DR_ID}`, ifMatch: 'W/"3"' });
    expect((putDr as any).resource).toMatchObject({
      id: DR_ID,
      status: 'active',
      codeCodeableConcept: { text: 'Ankle brace' },
    });

    expect(byMethod(rest, 'DELETE')).toEqual([{ method: 'DELETE', url: '/Procedure/proc-1' }]);
    const posts = byMethod(rest, 'POST');
    expect(posts).toHaveLength(1);
    expect((posts[0] as any).resource).toMatchObject({
      resourceType: 'Procedure',
      code: { coding: [{ code: 'L1820' }] },
    });
    expect((posts[0] as any).resource.basedOn).toBeUndefined();
    expect((putDr as any).resource.supportingInfo).toEqual([{ reference: (posts[0] as any).fullUrl }]);

    const taskPut = rest.find((r) => r.url === '/Task/task-open') as any;
    expect(taskPut.method).toBe('PUT');
    expect(taskPut.resource.description).toBe('Dispense Ankle brace');
    const inputValues = taskPut.resource.input.map((i: any) => [i.type.coding[0].code, i.valueString]);
    expect(inputValues).toEqual(
      expect.arrayContaining([
        [DME_TASK.input.itemName, 'Ankle brace'],
        [DME_TASK.input.providerName, 'Jane Doe, MD'],
      ])
    );
    expect(rest.some((r) => r.url === '/Task/task-done')).toBe(false);
  });

  it('edit to third-party drops billing and cancels the open dispense task', () => {
    const requests = makeEditRequests({
      resources: resources(),
      fields: fields({ external: true }),
      providerName: 'x',
    });
    expect(byMethod(requests, 'POST')).toHaveLength(0);
    expect(byMethod(requests, 'DELETE')).toHaveLength(1);
    expect((requests[0] as any).resource.supportingInfo).toBeUndefined();
    const patches = byMethod(requests, 'PATCH');
    expect(patches.map((p) => p.url)).toEqual(['/Task/task-open']);
    expect(decodePatch(patches[0])).toEqual([{ op: 'replace', path: '/status', value: 'cancelled' }]);
  });

  it('edit posts a new dispense task when an in-house order has none open', () => {
    const res = resources({ tasks: [dispenseTask('task-done', 'completed')] });
    expect(needsNewDispenseTask(res, fields())).toBe(true);
    expect(needsNewDispenseTask(res, fields({ external: true }))).toBe(false);
    expect(needsNewDispenseTask(resources(), fields())).toBe(false);

    const newTask = dispenseTask('ignored', 'ready');
    const requests = makeEditRequests({
      resources: res,
      fields: fields(),
      providerName: 'x',
      newDispenseTask: newTask,
    });
    expect(requests.filter((r) => r.url === '/Task')).toEqual([{ method: 'POST', url: '/Task', resource: newTask }]);
  });

  it('refuses switching a dispensed order to third-party', () => {
    const res = resources({ deviceRequest: makeOrder({ status: 'completed' }) });
    expect(() => makeEditRequests({ resources: res, fields: fields({ external: true }), providerName: 'x' })).toThrow();
  });

  it('dispense completes the order and its open task', () => {
    const owner = { reference: `Practitioner/${PRACTITIONER_ID}`, display: 'Jane Doe' };
    const at = '2026-10-16T12:00:00.000Z';
    const requests = makeDispenseRequests({ resources: resources(), practitionerId: PRACTITIONER_ID, owner, at });

    const dr = (requests[0] as any).resource as DeviceRequest;
    expect(dr.status).toBe('completed');
    expect(dr.extension?.filter((e) => e.url === DME_DISPENSED_EXTENSION_URL)).toHaveLength(1);
    expect(getDmeDispensed(dr)).toEqual({ practitionerId: PRACTITIONER_ID, at });

    const patches = byMethod(requests, 'PATCH');
    expect(patches.map((p) => p.url)).toEqual(['/Task/task-open']);
    expect(decodePatch(patches[0])).toEqual([
      { op: 'replace', path: '/status', value: 'completed' },
      { op: 'add', path: '/owner', value: owner },
    ]);
  });

  it('dispense rejects third-party and non-pending orders', () => {
    const args = { practitionerId: PRACTITIONER_ID, owner: undefined, at: '2026-10-16T12:00:00.000Z' };
    expect(() =>
      makeDispenseRequests({ ...args, resources: resources({ deviceRequest: makeOrder({}, true) }) })
    ).toThrow();
    expect(() =>
      makeDispenseRequests({ ...args, resources: resources({ deviceRequest: makeOrder({ status: 'completed' }) }) })
    ).toThrow();
  });

  it('delete revokes the order, removes billing and cancels open tasks', () => {
    const requests = makeDeleteRequests(resources());
    expect((requests[0] as any).resource).toMatchObject({ status: 'revoked', supportingInfo: undefined });
    expect(byMethod(requests, 'DELETE')).toEqual([{ method: 'DELETE', url: '/Procedure/proc-1' }]);
    const patches = byMethod(requests, 'PATCH');
    expect(patches.map((p) => p.url)).toEqual(['/Task/task-open']);
    expect(decodePatch(patches[0])).toEqual([{ op: 'replace', path: '/status', value: 'cancelled' }]);
  });
});

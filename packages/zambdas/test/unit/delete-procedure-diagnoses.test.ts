import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { applyPatch, Operation } from 'fast-json-patch';
import { Condition, Encounter, FhirResource, ServiceRequest } from 'fhir/r4b';
import { DeleteChartDataRequest } from 'utils/lib/types/api/chart-data/delete-chart-data.types';
import { ADDED_VIA_PROCEDURE_EXTENSION } from 'utils/lib/types/api/procedures.constants';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/delete-chart-data/index';
import { createProcedureServiceRequest } from '../../src/shared/chart-data/index';

const { transaction, resources, search } = vi.hoisted(() => ({
  transaction: vi.fn().mockResolvedValue({ resourceType: 'Bundle', type: 'transaction-response', entry: [] }),
  resources: [] as FhirResource[],
  search: vi.fn(),
}));
vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: () => ({ fhir: { transaction, search } }),
}));
vi.mock('../../src/shared/chart-data/post-change-tasks', () => ({ runChartDataPostChangeTasks: vi.fn() }));

const encounterId = '550e8400-e29b-41d4-a716-446655440000';
const condition = (id: string): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/patient' },
  encounter: { reference: `Encounter/${encounterId}` },
  extension: [{ url: ADDED_VIA_PROCEDURE_EXTENSION, valueBoolean: true }],
});
const procedure = (id: string, ids = ['first', 'second']): ServiceRequest =>
  createProcedureServiceRequest(
    {
      resourceId: id,
      diagnoses: ids.map((resourceId) => ({ resourceId, code: 'J06.9', display: 'URI', isPrimary: false })),
    },
    encounterId,
    'patient'
  ).resource;
const submit = async (
  data: Omit<DeleteChartDataRequest, 'encounterId'> = {
    procedures: [{ resourceId: 'procedure' }],
    cleanupProcedureDiagnoses: true,
  }
): Promise<APIGatewayProxyResult> => {
  const result = await index(
    {
      headers: { Authorization: 'Bearer token' },
      secrets: { ENVIRONMENT: 'local' },
      body: JSON.stringify({ encounterId, ...data }),
    },
    {} as Context,
    vi.fn()
  );
  if (!result) throw new Error('Missing handler response');
  return result;
};
const requests = (): BatchInputRequest<FhirResource>[] => transaction.mock.calls[0][0].requests;
const deletes = (): string[] =>
  requests()
    .filter((request) => request.method === 'DELETE')
    .map((request) => request.url);
const patchFor = (url: string): Operation[] => {
  const patch = requests().find((request) => request.method === 'PATCH' && request.url === url);
  const resource = patch && 'resource' in patch ? patch.resource : undefined;
  if (resource?.resourceType !== 'Binary') throw new Error(`Missing patch for ${url}`);
  return JSON.parse(Buffer.from(resource.data!, 'base64').toString('utf8'));
};

beforeEach(() => {
  vi.clearAllMocks();
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'in-progress',
    class: { code: 'AMB' },
    subject: { reference: 'Patient/patient' },
    diagnosis: [
      { condition: { reference: 'Condition/primary' }, rank: 1 },
      { condition: { reference: 'Condition/first' }, rank: 2 },
      { condition: { reference: 'Condition/second' }, rank: 3 },
    ],
  };
  resources.splice(
    0,
    resources.length,
    encounter,
    { resourceType: 'Patient', id: 'patient' },
    condition('first'),
    condition('second'),
    procedure('procedure')
  );
  search.mockImplementation(async () => ({
    total: 1,
    entry: [{ search: { mode: 'match' }, resource: resources[0] }],
    unbundle: () => resources,
  }));
});

describe('deleting a procedure and its owned diagnoses', () => {
  it('cancels the procedure and removes orphan diagnoses in one transaction with descending encounter indices', async () => {
    const result = await submit();
    expect(result.statusCode).toBe(200);
    expect(deletes()).toEqual(['/Condition/first', '/Condition/second']);
    expect(patchFor(`/Encounter/${encounterId}`)).toEqual([
      { op: 'remove', path: '/diagnosis/2' },
      { op: 'remove', path: '/diagnosis/1' },
    ]);
    expect(patchFor('/ServiceRequest/procedure')).toContainEqual({
      op: 'replace',
      path: '/status',
      value: 'entered-in-error',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].params).toEqual(
      expect.arrayContaining([
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
        { name: '_revinclude:iterate', value: 'MedicationRequest:encounter' },
        { name: '_revinclude:iterate', value: 'MedicationAdministration:context' },
      ])
    );
  });

  it('preserves a shared diagnosis until its final active procedure is deleted', async () => {
    resources.push(procedure('other', ['first']));
    await submit();
    expect(deletes()).toEqual(['/Condition/second']);
    for (const resource of resources) {
      if (resource.resourceType === 'Encounter' && resource.id === encounterId)
        applyPatch(resource, patchFor(`/Encounter/${encounterId}`));
      if (resource.resourceType === 'ServiceRequest' && resource.id === 'procedure')
        applyPatch(resource, patchFor('/ServiceRequest/procedure'));
    }
    const second = resources.findIndex((resource) => resource.resourceType === 'Condition' && resource.id === 'second');
    resources.splice(second, 1);
    transaction.mockClear();
    await submit({ procedures: [{ resourceId: 'other' }], cleanupProcedureDiagnoses: true });
    expect(deletes()).toEqual(['/Condition/first']);
    expect(patchFor(`/Encounter/${encounterId}`)).toEqual([{ op: 'remove', path: '/diagnosis/1' }]);
  });

  it('preserves a diagnosis referenced by an active prescription', async () => {
    resources.push({
      resourceType: 'MedicationRequest',
      id: 'med',
      status: 'active',
      intent: 'order',
      subject: { reference: 'Patient/patient' },
      medicationCodeableConcept: { text: 'Medication' },
      reasonReference: [{ reference: 'Condition/first' }],
    });
    await submit();
    expect(deletes()).toEqual(['/Condition/second']);
  });

  it.each(['primary', 'legacy', 'lab', 'other-visit'] as const)('preserves %s diagnoses', async (origin) => {
    const first = resources.find(
      (resource): resource is Condition => resource.resourceType === 'Condition' && resource.id === 'first'
    )!;
    if (origin === 'primary') (resources[0] as Encounter).diagnosis![1].rank = 1;
    if (origin === 'legacy') first.extension = undefined;
    if (origin === 'lab') first.extension!.push({ url: ADDED_VIA_LAB_ORDER_SYSTEM, valueBoolean: true });
    if (origin === 'other-visit') first.encounter = { reference: 'Encounter/other' };
    await submit();
    expect(deletes()).toEqual(['/Condition/second']);
  });

  it('deduplicates explicit and automatic diagnosis deletions and removes encounter links in descending order', async () => {
    await submit({
      procedures: [{ resourceId: 'procedure' }],
      cleanupProcedureDiagnoses: true,
      diagnosis: [{ resourceId: 'first', code: 'J06.9', display: 'URI', isPrimary: false }],
    });
    expect(deletes()).toEqual(['/Condition/first', '/Condition/second']);
    expect(patchFor(`/Encounter/${encounterId}`)).toEqual([
      { op: 'remove', path: '/diagnosis/2' },
      { op: 'remove', path: '/diagnosis/1' },
    ]);
  });

  it('keeps legacy deletion requests unchanged and avoids the additional dependency query', async () => {
    await submit({ procedures: [{ resourceId: 'procedure' }] });
    expect(deletes()).toEqual([]);
    expect(requests().some((request) => request.url === `/Encounter/${encounterId}`)).toBe(false);
    expect(search.mock.calls[0][0].params).not.toEqual(
      expect.arrayContaining([{ name: '_revinclude:iterate', value: 'Condition:encounter' }])
    );
  });
});

import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { Condition, Encounter, FhirResource, Patient } from 'fhir/r4b';
import { ADDED_VIA_PROCEDURE_EXTENSION } from 'utils/lib/types/api/procedures.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/save-chart-data/index';
import { createProcedureServiceRequest, makeDiagnosisConditionResource } from '../../src/shared/chart-data/index';

const { transaction, resources, dependencies, create, update } = vi.hoisted(() => ({
  transaction: vi.fn().mockResolvedValue({ resourceType: 'Bundle', type: 'transaction-response', entry: [] }),
  create: vi.fn().mockImplementation(async (resource: FhirResource) => ({ ...resource, id: 'created' })),
  update: vi.fn(),
  resources: [] as FhirResource[],
  dependencies: vi.fn(),
}));
vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: () => ({
    fhir: {
      transaction,
      create,
      update,
      get: vi.fn().mockResolvedValue({ resourceType: 'Practitioner', id: 'practitioner' }),
    },
  }),
}));
vi.mock('../../src/shared/practitioners', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/practitioners')>()),
  getMyPractitionerId: vi.fn().mockResolvedValue('practitioner'),
}));
vi.mock('../../src/shared/chart-data/post-change-tasks', () => ({ runChartDataPostChangeTasks: vi.fn() }));
vi.mock('../../src/ehr/save-chart-data/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/save-chart-data/helpers')>()),
  getEncounterAndRelatedResources: async (...args: unknown[]) => {
    dependencies(...args);
    return resources;
  },
}));

const encounterId = '550e8400-e29b-41d4-a716-446655440000';
const condition = (id: string): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/patient' },
  encounter: { reference: `Encounter/${encounterId}` },
  extension: [{ url: ADDED_VIA_PROCEDURE_EXTENSION, valueBoolean: true }],
});
const submit = async (cleanupProcedureDiagnoses = true): Promise<APIGatewayProxyResult> => {
  const result = await index(
    {
      headers: { Authorization: 'Bearer token' },
      secrets: { ENVIRONMENT: 'local' },
      body: JSON.stringify({
        encounterId,
        cleanupProcedureDiagnoses,
        procedures: [{ resourceId: 'procedure', diagnoses: [] }],
      }),
    },
    {} as Context,
    vi.fn()
  );
  if (!result) throw new Error('Missing handler response');
  return result;
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
  const patient: Patient = { resourceType: 'Patient', id: 'patient' };
  resources.splice(
    0,
    resources.length,
    encounter,
    patient,
    condition('first'),
    condition('second'),
    createProcedureServiceRequest(
      {
        resourceId: 'procedure',
        diagnoses: [
          { resourceId: 'first', code: 'J06.9', display: 'URI', isPrimary: false },
          { resourceId: 'second', code: 'R05.9', display: 'Cough', isPrimary: false },
        ],
      },
      encounterId,
      'patient'
    ).resource
  );
});

describe('procedure diagnosis cleanup transaction', () => {
  it('reuses a matching visit diagnosis at the API boundary without changing primary status or origin', async () => {
    resources.push(
      makeDiagnosisConditionResource(
        encounterId,
        'patient',
        { resourceId: 'primary', code: 'J06.9', display: 'URI', isPrimary: true },
        'diagnosis'
      )
    );
    const result = await index(
      {
        headers: { Authorization: 'Bearer token' },
        secrets: { ENVIRONMENT: 'local' },
        body: JSON.stringify({
          encounterId,
          diagnosis: [{ code: 'J06.9', display: 'URI', isPrimary: false, addedViaProcedure: true }],
        }),
      },
      {} as Context,
      vi.fn()
    );
    if (!result) throw new Error('Missing handler response');
    expect(result.statusCode).toBe(200);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).chartData.diagnosis).toEqual([
      expect.objectContaining({ resourceId: 'primary', code: 'J06.9', isPrimary: true }),
    ]);
    expect(JSON.parse(result.body).chartData.diagnosis[0]).not.toHaveProperty('addedViaProcedure');
    expect(transaction.mock.calls[0][0].requests).toEqual([]);
  });
  it('records origin on the actual new Condition sent to FHIR', async () => {
    const result = await index(
      {
        headers: { Authorization: 'Bearer token' },
        secrets: { ENVIRONMENT: 'local' },
        body: JSON.stringify({
          encounterId,
          diagnosis: [{ code: 'J06.9', display: 'URI', isPrimary: false, addedViaProcedure: true }],
        }),
      },
      {} as Context,
      vi.fn()
    );
    if (!result) throw new Error('Missing handler response');
    expect(result.statusCode).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ extension: [{ url: ADDED_VIA_PROCEDURE_EXTENSION, valueBoolean: true }] })
    );
  });

  it('leaves legacy callers in control of their own cleanup', async () => {
    const result = await submit(false);
    expect(JSON.parse(result.body)).not.toHaveProperty('deletedDiagnosisIds');
    expect(
      transaction.mock.calls[0][0].requests.some(
        (request: BatchInputRequest<FhirResource>) => request.method === 'DELETE'
      )
    ).toBe(false);
  });

  it('unlinks and deletes owned orphan diagnoses in one transaction with safe Encounter indices', async () => {
    const result = await submit();
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).deletedDiagnosisIds).toEqual(['first', 'second']);
    expect(dependencies).toHaveBeenCalledWith(expect.anything(), encounterId, true);
    const requests: BatchInputRequest<FhirResource>[] = transaction.mock.calls[0][0].requests;
    expect(requests.filter((request) => request.method === 'DELETE').map((request) => request.url)).toEqual([
      '/Condition/first',
      '/Condition/second',
    ]);
    const patch = requests.find((request) => request.method === 'PATCH' && request.url === `/Encounter/${encounterId}`);
    const binary = patch && 'resource' in patch ? patch.resource : undefined;
    if (binary?.resourceType !== 'Binary') throw new Error('Missing Encounter patch');
    expect(JSON.parse(Buffer.from(binary.data!, 'base64').toString('utf8'))).toEqual([
      { op: 'remove', path: '/diagnosis/2' },
      { op: 'remove', path: '/diagnosis/1' },
    ]);
    const saved = requests.find((request) => request.method === 'PUT' && request.url === '/ServiceRequest/procedure');
    expect(saved && 'resource' in saved ? saved.resource : undefined).not.toHaveProperty(
      'reasonReference',
      expect.anything()
    );
  });
  it('keeps a diagnosis used by another order and deletes only the orphan', async () => {
    resources.push({
      ...createProcedureServiceRequest(
        { resourceId: 'lab', diagnoses: [{ resourceId: 'first', code: 'J06.9', display: 'URI', isPrimary: false }] },
        encounterId,
        'patient'
      ).resource,
      meta: { tag: [{ code: 'external-lab' }] },
    });
    const result = await submit();
    expect(JSON.parse(result.body).deletedDiagnosisIds).toEqual(['second']);
    expect(
      transaction.mock.calls[0][0].requests
        .filter((request: BatchInputRequest<FhirResource>) => request.method === 'DELETE')
        .map((request: BatchInputRequest<FhirResource>) => request.url)
    ).toEqual(['/Condition/second']);
  });
});

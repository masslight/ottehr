import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, List, Practitioner, Task } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared';

// The exported `index` is typed as an AWS 3-arg Handler, but `wrapHandler` is mocked to
// return the single-arg inner function; cast the imports to reflect the runtime shape.
type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockOystehr, mockDeleteZ3Object, mockCaptureException } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      get: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      transaction: vi.fn(),
    },
  },
  mockDeleteZ3Object: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createOystehrClient: vi.fn(() => mockOystehr),
  };
});

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    getAuth0Token: vi.fn().mockResolvedValue('mock-token'),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/shared/z3Utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    deleteZ3Object: mockDeleteZ3Object,
  };
});

vi.mock('@sentry/aws-serverless', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    captureException: mockCaptureException,
  };
});

import {
  APIErrorCode,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL,
} from 'utils';
import { index as deleteInboundFaxRaw } from '../../src/ehr/delete-inbound-fax/index';
import { index as fileInboundFaxRaw } from '../../src/ehr/file-inbound-fax/index';
import { Z3Error } from '../../src/shared/z3Utils';
import { index as handleInboundFaxRaw } from '../../src/subscriptions/communication/handle-inbound-fax/index';

const fileInboundFax = fileInboundFaxRaw as unknown as ZambdaHandler;
const deleteInboundFax = deleteInboundFaxRaw as unknown as ZambdaHandler;
const handleInboundFax = handleInboundFaxRaw as unknown as ZambdaHandler;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TASK_PDF_URL = 'https://project-api.example.com/z3/fax-bucket/comm-456/fax.pdf';
const CLIENT_SUPPLIED_PDF_URL = 'https://project-api.example.com/z3/other-bucket/victim-patient/private-doc.pdf';

const secrets = {
  ENVIRONMENT: 'local',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
};

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return {
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
    secrets,
  };
}

function makeFaxTask(overrides: Partial<Task> = {}): Task {
  return {
    resourceType: 'Task',
    id: 'task-123',
    status: 'ready',
    intent: 'order',
    groupIdentifier: { value: 'inbound-fax' },
    basedOn: [{ reference: 'Communication/comm-456' }],
    input: [
      { type: { coding: [{ code: 'sender-fax-number' }] }, valueString: '+15551234567' },
      { type: { coding: [{ code: 'pdf-url' }] }, valueString: TASK_PDF_URL },
    ],
    ...overrides,
  };
}

function makeFolderList(overrides: Partial<List> = {}): List {
  return {
    resourceType: 'List',
    id: 'folder-abc',
    status: 'current',
    mode: 'working',
    subject: { reference: 'Patient/patient-789' },
    entry: [],
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSearchBundle(resources: (Task | Practitioner)[], hasNext = false) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    link: hasNext ? [{ relation: 'next', url: 'http://next' }] : [],
    unbundle: () => resources,
  };
}

const fileBody = {
  taskId: 'task-123',
  communicationId: 'comm-456',
  patientId: 'patient-789',
  folderId: 'folder-abc',
  documentName: 'Fax from +15551234567',
  // a malicious/stale client value that the server must ignore
  pdfUrl: CLIENT_SUPPLIED_PDF_URL,
};

const deleteBody = {
  taskId: 'task-123',
  communicationId: 'comm-456',
  pdfUrl: CLIENT_SUPPLIED_PDF_URL,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// file-inbound-fax handler
// ---------------------------------------------------------------------------

describe('file-inbound-fax handler', () => {
  function mockHappyPathReads(task: Task = makeFaxTask(), folder: List = makeFolderList()): void {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return task;
      if (resourceType === 'List') return folder;
      throw new Error(`unexpected get for ${resourceType}`);
    });
    mockOystehr.fhir.transaction.mockResolvedValue({
      entry: [{ resource: { resourceType: 'DocumentReference', id: 'docref-1' } }],
    });
  }

  it('SECURITY: ignores a client-supplied pdfUrl and files the URL stored on the verified Task', async () => {
    mockHappyPathReads();

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentRefId: 'docref-1', folderId: 'folder-abc' });

    expect(mockOystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
    const docRefPost = requests.find((r: any) => r.method === 'POST' && r.url === '/DocumentReference');
    expect(docRefPost).toBeDefined();
    expect(docRefPost.resource.content[0].attachment.url).toBe(TASK_PDF_URL);
    expect(docRefPost.resource.content[0].attachment.url).not.toBe(CLIENT_SUPPLIED_PDF_URL);
    expect(JSON.stringify(requests)).not.toContain(CLIENT_SUPPLIED_PDF_URL);
  });

  it('files the DocumentReference, List update, and Task completion as a single transaction', async () => {
    mockHappyPathReads();

    await fileInboundFax(makeInput(fileBody));

    const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
    expect(requests).toHaveLength(3);

    const docRefPost = requests.find((r: any) => r.method === 'POST' && r.url === '/DocumentReference');
    const listPut = requests.find((r: any) => r.method === 'PUT' && r.url === '/List/folder-abc');
    const taskPatch = requests.find((r: any) => r.method === 'PATCH' && r.url === '/Task/task-123');
    expect(docRefPost).toBeDefined();
    expect(listPut).toBeDefined();
    expect(taskPatch).toBeDefined();

    // The new List entry must reference the transaction-local id of the POSTed DocumentReference
    expect(docRefPost.fullUrl).toMatch(/^urn:uuid:/);
    expect(listPut.resource.entry).toHaveLength(1);
    expect(listPut.resource.entry[0].item.reference).toBe(docRefPost.fullUrl);

    // No non-transactional writes
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('rejects a non-inbound-fax task', async () => {
    mockHappyPathReads(makeFaxTask({ groupIdentifier: { value: 'radiology' } }));

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(body.message).toContain('is not an inbound-fax task');
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the task is not associated with the given communication', async () => {
    mockHappyPathReads(makeFaxTask({ basedOn: [{ reference: 'Communication/some-other-comm' }] }));

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain('is not associated with Communication/comm-456');
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('rejects a folder that does not belong to the patient', async () => {
    mockHappyPathReads(makeFaxTask(), makeFolderList({ subject: { reference: 'Patient/someone-else' } }));

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(body.message).toContain('does not belong to Patient/patient-789');
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it.each(['completed', 'cancelled'] as const)('rejects an already-%s task', async (status) => {
    mockHappyPathReads(makeFaxTask({ status }));

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe(APIErrorCode.PRECONDITION_FAILED);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    mockOystehr.fhir.get.mockRejectedValue(new Error('not found'));

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// delete-inbound-fax handler
// ---------------------------------------------------------------------------

describe('delete-inbound-fax handler', () => {
  function mockTaskRead(task: Task = makeFaxTask()): void {
    mockOystehr.fhir.get.mockResolvedValue(task);
    mockOystehr.fhir.transaction.mockResolvedValue({});
  }

  it('SECURITY: ignores a client-supplied pdfUrl and deletes the Z3 object stored on the verified Task', async () => {
    mockTaskRead();
    mockDeleteZ3Object.mockResolvedValue(undefined);

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(200);
    expect(mockDeleteZ3Object).toHaveBeenCalledTimes(1);
    expect(mockDeleteZ3Object).toHaveBeenCalledWith(TASK_PDF_URL, 'mock-token');
    expect(mockDeleteZ3Object).not.toHaveBeenCalledWith(CLIENT_SUPPLIED_PDF_URL, expect.anything());

    // Communication delete + Task cancel are one transaction
    const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.some((r: any) => r.method === 'DELETE' && r.url === '/Communication/comm-456')).toBe(true);
    expect(requests.some((r: any) => r.method === 'PATCH' && r.url === '/Task/task-123')).toBe(true);
  });

  it('rejects a non-inbound-fax task without deleting anything', async () => {
    mockTaskRead(makeFaxTask({ groupIdentifier: { value: 'radiology' } }));

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain('is not an inbound-fax task');
    expect(mockDeleteZ3Object).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the task is not associated with the given communication', async () => {
    mockTaskRead(makeFaxTask({ basedOn: [{ reference: 'Communication/some-other-comm' }] }));

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(400);
    expect(mockDeleteZ3Object).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it.each(['completed', 'cancelled'] as const)('rejects an already-%s task', async (status) => {
    mockTaskRead(makeFaxTask({ status }));

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.PRECONDITION_FAILED);
    expect(mockDeleteZ3Object).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('fails the operation (without touching FHIR) when the Z3 delete fails, and reports it', async () => {
    mockTaskRead();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error('delete failed', 500));

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(500);
    expect(mockCaptureException).toHaveBeenCalled();
    // Nothing else deleted: the operation stays retryable and the PDF is never orphaned
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('continues when the Z3 object is already gone (404)', async () => {
    mockTaskRead();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error('not found', 404));

    const result = await deleteInboundFax(makeInput(deleteBody));

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.transaction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// handle-inbound-fax handler
// ---------------------------------------------------------------------------

describe('handle-inbound-fax handler', () => {
  const communication: Communication = {
    resourceType: 'Communication',
    id: 'comm-456',
    status: 'completed',
    received: '2026-03-13T10:00:00Z',
    sender: { reference: '#fax-sender' },
    contained: [
      {
        resourceType: 'Device',
        id: 'fax-sender',
        identifier: [{ system: 'phone', value: '+15551234567' }],
      },
    ],
    payload: [{ contentAttachment: { url: TASK_PDF_URL } }],
    extension: [{ url: 'https://extensions.fhir.oystehr.com/fax-pages', valueInteger: 3 }],
  };

  const taskNotificationsEnabledExtension = {
    url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
    extension: [{ url: PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL, valueBoolean: true }],
  };

  function makePractitioner(id: string, overrides: Partial<Practitioner> = {}): Practitioner {
    return {
      resourceType: 'Practitioner',
      id,
      extension: [taskNotificationsEnabledExtension],
      ...overrides,
    };
  }

  function mockSearches({ existingTasks = [] as Task[], practitioners = [] as Practitioner[] } = {}): void {
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return makeSearchBundle(existingTasks);
      if (resourceType === 'Practitioner') return makeSearchBundle(practitioners);
      throw new Error(`unexpected search for ${resourceType}`);
    });
    mockOystehr.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-new' });
    mockOystehr.fhir.transaction.mockResolvedValue({});
  }

  it('is idempotent: a re-fired subscription for the same Communication no-ops', async () => {
    mockSearches({ existingTasks: [makeFaxTask()] });

    const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ taskId: 'task-123', alreadyProcessed: true });
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('still creates a task when a based-on Task exists but is not an inbound-fax task', async () => {
    mockSearches({ existingTasks: [makeFaxTask({ groupIdentifier: { value: 'radiology' } })] });

    const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.create).toHaveBeenCalledTimes(1);
  });

  it('creates the task with the pdf url from the Communication payload', async () => {
    mockSearches();

    await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    const createdTask = mockOystehr.fhir.create.mock.calls[0][0] as Task;
    expect(createdTask.groupIdentifier?.value).toBe('inbound-fax');
    expect(createdTask.basedOn?.[0]?.reference).toBe('Communication/comm-456');
    const pdfInput = createdTask.input?.find((i) => i.type?.coding?.some((c) => c.code === 'pdf-url'));
    expect(pdfInput?.valueString).toBe(TASK_PDF_URL);
  });

  it('notifies only active practitioners with task notifications enabled', async () => {
    mockSearches({
      practitioners: [
        makePractitioner('active-1'),
        makePractitioner('deactivated-1', { active: false }),
        makePractitioner('no-notifications', { extension: [] }),
        makePractitioner('active-2', { active: true }),
      ],
    });

    const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
    const recipients = requests.map((r: any) => r.resource.recipient[0].reference);
    expect(recipients).toEqual(['Practitioner/active-1', 'Practitioner/active-2']);
  });

  it('reports but does not fail ingestion when the notification fan-out fails', async () => {
    mockSearches({ practitioners: [makePractitioner('active-1')] });
    mockOystehr.fhir.transaction.mockRejectedValue(new Error('fan-out failed'));

    const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ taskId: 'task-new' });
    expect(mockCaptureException).toHaveBeenCalled();
  });
});

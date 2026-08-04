import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, List, Task } from 'fhir/r4b';
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

import { APIErrorCode, FAX_TASK, getUiTaskCategoryForCode, OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL } from 'utils';
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
function makeSearchBundle(resources: (Task | List)[], hasNext = false) {
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
  // The folder is resolved through the shared `resolvePatientDocumentFolder`, which reads the
  // List via search (`_id` + `_include=List:subject`) rather than a direct get.
  // `folder: null` means the List search finds nothing (note: passing `undefined` would fall
  // back to the default parameter).
  function mockHappyPathReads(task: Task = makeFaxTask(), folder: List | null = makeFolderList()): void {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return task;
      throw new Error(`unexpected get for ${resourceType}`);
    });
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'List') return makeSearchBundle(folder ? [folder] : []);
      throw new Error(`unexpected search for ${resourceType}`);
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

  it('returns 404 when the folder does not exist', async () => {
    mockHappyPathReads(makeFaxTask(), null);

    const result = await fileInboundFax(makeInput(fileBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('guards the folder List update with an optimistic lock so a concurrent edit cannot be clobbered', async () => {
    mockHappyPathReads(makeFaxTask(), makeFolderList({ meta: { versionId: '7' } }));

    await fileInboundFax(makeInput(fileBody));

    const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
    const listPut = requests.find((r: any) => r.method === 'PUT' && r.url === '/List/folder-abc');
    expect(listPut.ifMatch).toBe('W/"7"');
  });

  describe('synthetic folder ids', () => {
    const syntheticBody = { ...fileBody, folderId: 'synthetic:visit-notes', internalName: 'visit-notes' };

    function mockSyntheticReads(createdFolder: List): void {
      mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
        if (resourceType === 'Task') return makeFaxTask();
        throw new Error(`unexpected get for ${resourceType}`);
      });
      // No existing per-patient List for this folder yet.
      mockOystehr.fhir.search.mockResolvedValue(makeSearchBundle([]));
      mockOystehr.fhir.create.mockResolvedValue(createdFolder);
      mockOystehr.fhir.transaction.mockResolvedValue({
        entry: [{ resource: { resourceType: 'DocumentReference', id: 'docref-1' } }],
      });
    }

    it('materializes the folder List server-side and files into it', async () => {
      mockSyntheticReads(makeFolderList({ id: 'folder-new', title: 'visit-notes' }));

      const result = await fileInboundFax(makeInput(syntheticBody));

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ documentRefId: 'docref-1', folderId: 'folder-new' });

      // Filed into the newly resolved List, not the synthetic sentinel
      const { requests } = mockOystehr.fhir.transaction.mock.calls[0][0];
      expect(requests.some((r: any) => r.method === 'PUT' && r.url === '/List/folder-new')).toBe(true);
      expect(JSON.stringify(requests)).not.toContain('synthetic:');
    });

    it('creates the folder List conditionally so concurrent filings cannot duplicate it', async () => {
      mockSyntheticReads(makeFolderList({ id: 'folder-new', title: 'visit-notes' }));

      await fileInboundFax(makeInput(syntheticBody));

      expect(mockOystehr.fhir.create).toHaveBeenCalledTimes(1);
      const [resource, options] = mockOystehr.fhir.create.mock.calls[0];
      expect(resource.resourceType).toBe('List');
      // Keyed on exact-match params only — `title` is prefix-match and would let the conditional
      // create latch onto a different folder whose name starts with this one.
      expect(options.ifNoneExist).toEqual([
        { name: 'subject', value: 'Patient/patient-789' },
        { name: 'identifier', value: 'visit-notes' },
      ]);
    });

    it('refuses a folder name that is in neither the system config nor the catalog', async () => {
      mockOystehr.fhir.get.mockResolvedValue(makeFaxTask());
      mockOystehr.fhir.search.mockResolvedValue(makeSearchBundle([]));

      const result = await fileInboundFax(
        makeInput({ ...fileBody, folderId: 'synthetic:not-a-real-folder', internalName: 'not-a-real-folder' })
      );

      expect(result.statusCode).toBe(404);
      expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });
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

  function mockSearches({ existingTasks = [] as Task[] } = {}): void {
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return makeSearchBundle(existingTasks);
      throw new Error(`unexpected search for ${resourceType}`);
    });
    // Echo the submitted resource back with an id, the way a real FHIR create does — the handler
    // detects "my conditional create actually created this" by finding its own claim identifier
    // on the returned Task.
    mockOystehr.fhir.create.mockImplementation(async (resource: Task) => ({ ...resource, id: 'task-new' }));
    mockOystehr.fhir.transaction.mockResolvedValue({});
  }

  const FAX_TASK_CLAIM_SYSTEM = 'https://fhir.ottehr.com/Identifier/inbound-fax-task-claim';

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

  // The task is the only thing this handler writes. Staff notification is the notifications-updater
  // cron's job (it honors each practitioner's V2 preferences); fanning out here would ignore them
  // and scan every Practitioner in the project from inside a subscription.
  it('creates only the task, leaving notification fan-out to the notifications cron', async () => {
    mockSearches();

    const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ taskId: 'task-new' });
    expect(mockOystehr.fhir.create).toHaveBeenCalledTimes(1);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    // No Practitioner scan at all — mockSearches throws on any non-Task search.
    const searchedTypes = mockOystehr.fhir.search.mock.calls.map((call: any[]) => call[0].resourceType);
    expect(searchedTypes).toEqual(['Task']);
  });

  // The task category is what routes inbound faxes through the notifications cron, so it has to be
  // the value registered in TASK_CODE_TO_UI_CATEGORY.
  it('tags the task with the category the notifications cron subscribes to', async () => {
    mockSearches();

    await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

    const createdTask = mockOystehr.fhir.create.mock.calls[0][0] as Task;
    expect(createdTask.groupIdentifier?.value).toBe(FAX_TASK.category);
    expect(getUiTaskCategoryForCode(createdTask.groupIdentifier?.value)).toBe('inboundFax');
    // The cron only considers tasks in these statuses.
    expect(createdTask.status).toBe('ready');
  });

  describe('outbound faxes', () => {
    // `oystehr.fax.send` writes a medium=FAXWRIT Communication for every fax we *send*, which matches
    // the same subscription criteria. Oystehr stamps those with the outbound-fax-status extension.
    const outboundCommunication: Communication = {
      ...communication,
      id: 'comm-outbound',
      extension: [
        ...(communication.extension ?? []),
        { url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL, valueString: 'queued' },
      ],
    };

    it('skips an outbound fax instead of filing it as inbound', async () => {
      mockSearches();

      const result = await handleInboundFax(makeInput(outboundCommunication as unknown as Record<string, unknown>));

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ skipped: 'outbound-fax' });
      expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    });

    it('bails before doing any work, since outbound is the higher-volume case', async () => {
      mockSearches();

      await handleInboundFax(makeInput(outboundCommunication as unknown as Record<string, unknown>));

      expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });

    it('still ingests an inbound fax that carries other extensions', async () => {
      mockSearches();

      const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

      expect(JSON.parse(result.body)).toEqual({ taskId: 'task-new' });
      expect(mockOystehr.fhir.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent delivery of the same fax', () => {
    it('creates the task conditionally, so the server enforces at-most-one per Communication', async () => {
      mockSearches();

      await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

      const [resource, options] = mockOystehr.fhir.create.mock.calls[0];
      expect(options.ifNoneExist).toEqual([
        { name: 'based-on', value: 'Communication/comm-456' },
        { name: 'group-identifier', value: 'https://fhir.ottehr.com/Identifier/task-category|inbound-fax' },
      ]);
      // A single-use claim token distinguishes "created by me" from "already existed".
      expect(resource.identifier).toEqual([{ system: FAX_TASK_CLAIM_SYSTEM, value: expect.any(String) }]);
    });

    it('reports the winning task without creating a second one', async () => {
      mockSearches();
      // The race: the pre-search saw nothing, but by the time we wrote, another delivery had
      // created the task. The server returns *that* task, which carries no claim token of ours.
      mockOystehr.fhir.create.mockResolvedValue(makeFaxTask({ id: 'task-from-other-delivery' }));

      const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ taskId: 'task-from-other-delivery', alreadyProcessed: true });
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });

    it('reports without failing when the conditional create is rejected (multiple matches)', async () => {
      mockSearches();
      mockOystehr.fhir.create.mockRejectedValue(new Error('412 Precondition Failed'));

      const result = await handleInboundFax(makeInput(communication as unknown as Record<string, unknown>));

      // 200 keeps the subscription from retrying forever; Sentry carries the signal instead.
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ alreadyProcessed: true });
      expect(mockCaptureException).toHaveBeenCalled();
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });
  });
});

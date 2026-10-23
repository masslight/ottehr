import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, FhirResource, List, ServiceRequest } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockUserMe } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      get: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      transaction: vi.fn(),
    },
  },
  mockUserMe: vi.fn(),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createClinicalOystehrClient: vi.fn(() => mockOystehr),
  };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  };
});

vi.mock('utils/lib/auth/user-me.helper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/auth/user-me.helper')>();
  return {
    ...actual,
    userMe: mockUserMe,
  };
});

vi.mock('@sentry/node-core/light', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    init: vi.fn(),
    isInitialized: vi.fn(() => true),
    setTag: vi.fn(),
    setTags: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';
import { RADIOLOGY_REPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { index as uploadRadiologyResultRaw } from '../../src/ehr/radiology/upload-result/index';
import { isCurrentRadiologyResultDocRef } from '../../src/shared/radiology';

const uploadRadiologyResult = uploadRadiologyResultRaw as unknown as ZambdaHandler;

const PATIENT_ID = 'patient-1';
const SERVICE_REQUEST_ID = 'service-request-1';
const OTHER_SERVICE_REQUEST_ID = 'service-request-2';
const FOLDER_ID = 'radiology-reports-folder';
const FILE_TITLE = 'knee-xray.pdf';
const z3Url = (name: string): string =>
  `https://project-api.example.com/z3/project-1-patient-photos/${PATIENT_ID}/${name}`;
const Z3_URL = z3Url('knee-xray.pdf');

const secrets = {
  AUTH0_ENDPOINT: 'https://auth.example.com',
  AUTH0_CLIENT: 'client',
  AUTH0_SECRET: 'secret',
  AUTH0_AUDIENCE: 'audience',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ENVIRONMENT: 'local',
};

const makeInput = (serviceRequestId = SERVICE_REQUEST_ID, z3URL = Z3_URL, title = FILE_TITLE): ZambdaInput => ({
  headers: { Authorization: 'Bearer caller-token' },
  body: JSON.stringify({ serviceRequestId, z3URL, title }),
  secrets,
});

const makeServiceRequest = (id: string): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'order',
  subject: { reference: `Patient/${PATIENT_ID}` },
  encounter: { reference: 'Encounter/encounter-1' },
});

const makeRadiologyReportsFolder = (references?: string[]): List => ({
  resourceType: 'List',
  id: FOLDER_ID,
  meta: { versionId: '1' },
  status: 'current',
  mode: 'working',
  title: BUCKET_NAMES.RADIOLOGY_REPORTS,
  code: { coding: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: PATIENT_FOLDERS_CODE }] },
  subject: { reference: `Patient/${PATIENT_ID}` },
  ...(references ? { entry: references.map((reference) => ({ item: { type: 'DocumentReference', reference } })) } : {}),
});

const makeResultDocRef = ({
  id,
  url = Z3_URL,
  title = FILE_TITLE,
  serviceRequestId = SERVICE_REQUEST_ID,
  status = 'current',
}: {
  id: string;
  url?: string;
  title?: string;
  serviceRequestId?: string;
  status?: DocumentReference['status'];
}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status,
  type: { coding: [RADIOLOGY_RESULT_DOC_REF_DOCTYPE] },
  subject: { reference: `Patient/${PATIENT_ID}` },
  context: { related: [{ reference: `ServiceRequest/${serviceRequestId}` }] },
  content: [{ attachment: { url, title } }],
});

interface FakeFhirStore {
  serviceRequests: ServiceRequest[];
  docRefs: DocumentReference[];
  folders: List[];
  folderPatchFailures: number[];
  folderPatchAttempts: number;
  versionConflicts: number;
  nextId: number;
}

let store: FakeFhirStore;

const paramValue = (params: { name: string; value: string }[] | undefined, name: string): string | undefined =>
  params?.find((param) => param.name === name)?.value;

const installFakeFhir = ({ docRefs = [], folders = [] }: { docRefs?: DocumentReference[]; folders?: List[] }): void => {
  store = {
    serviceRequests: [makeServiceRequest(SERVICE_REQUEST_ID), makeServiceRequest(OTHER_SERVICE_REQUEST_ID)],
    docRefs: structuredClone(docRefs),
    folders: structuredClone(folders),
    folderPatchFailures: [],
    folderPatchAttempts: 0,
    versionConflicts: 0,
    nextId: 1,
  };

  mockOystehr.fhir.get.mockImplementation(async ({ resourceType, id }: { resourceType: string; id: string }) => {
    if (resourceType === 'ServiceRequest') return structuredClone(store.serviceRequests.find((sr) => sr.id === id));
    if (resourceType === 'List') return structuredClone(store.folders.find((folder) => folder.id === id));
    return { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Pat'], family: 'Provider' }] };
  });

  mockOystehr.fhir.search.mockImplementation(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      let results: FhirResource[];
      if (resourceType === 'List') {
        results = store.folders.filter((folder) => folder.subject?.reference === paramValue(params, 'subject'));
      } else {
        const related = paramValue(params, 'related');
        const status = paramValue(params, 'status');
        results = store.docRefs.filter(
          (docRef) =>
            docRef.context?.related?.some((reference) => reference.reference === related) &&
            (!status || docRef.status === status)
        );
      }
      return { unbundle: () => structuredClone(results) };
    }
  );

  mockOystehr.fhir.create.mockImplementation(async (list: List) => {
    const created: List = { ...list, id: 'created-radiology-reports-folder', meta: { versionId: '1' } };
    const { entry, ...withoutEntry } = created;
    store.folders.push(entry?.length ? created : withoutEntry);
    return structuredClone(created);
  });

  mockOystehr.fhir.transaction.mockImplementation(
    async ({ requests }: { requests: { resource: DocumentReference }[] }) => {
      const created: DocumentReference = { ...requests[0].resource, id: `new-result-doc-ref-${store.nextId++}` };
      store.docRefs.push(created);
      return { entry: [{ resource: structuredClone(created) }] };
    }
  );

  mockOystehr.fhir.patch.mockImplementation(
    async (
      {
        resourceType,
        id,
        operations,
      }: { resourceType: string; id: string; operations: { op: string; path: string; value: any }[] },
      options?: { optimisticLockingVersionId?: string }
    ) => {
      if (resourceType === 'DocumentReference') {
        const docRef = store.docRefs.find((candidate) => candidate.id === id)!;
        docRef.status = operations[0].value;
        return structuredClone(docRef);
      }
      store.folderPatchAttempts++;
      const folder = store.folders.find((candidate) => candidate.id === id)!;
      const failure = store.folderPatchFailures.shift();
      if (failure) {
        throw { code: failure, message: `Request failed with status ${failure}` };
      }
      if (options?.optimisticLockingVersionId && options.optimisticLockingVersionId !== folder.meta?.versionId) {
        store.versionConflicts++;
        throw { code: 412, message: 'Precondition Failed' };
      }
      if (operations[0].op === 'replace' && folder.entry === undefined) {
        throw { code: 422, message: 'Cannot perform the operation at a path that does not exist' };
      }
      folder.entry = operations[0].value;
      folder.meta = { versionId: String(Number(folder.meta?.versionId) + 1) };
      return structuredClone(folder);
    }
  );
};

const folderReferences = (folderId = FOLDER_ID): string[] =>
  (store.folders.find((folder) => folder.id === folderId)?.entry ?? []).map((entry) => entry.item.reference ?? '');

const docRefStatus = (id: string): DocumentReference['status'] | undefined =>
  store.docRefs.find((docRef) => docRef.id === id)?.status;

describe('radiology-upload-result handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserMe.mockResolvedValue({ profile: 'Practitioner/practitioner-1' });
  });

  it('files a new result into the existing Radiology Reports folder with a version-checked write', async () => {
    installFakeFhir({ folders: [makeRadiologyReportsFolder()] });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: 'new-result-doc-ref-1' });
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(folderReferences()).toEqual(['DocumentReference/new-result-doc-ref-1']);
    expect(mockOystehr.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'List', id: FOLDER_ID }),
      {
        optimisticLockingVersionId: '1',
      }
    );
  });

  it('types the result as a LOINC diagnostic imaging report that order lookups still recognize', async () => {
    installFakeFhir({ folders: [makeRadiologyReportsFolder()] });

    await uploadRadiologyResult(makeInput());

    const createdDocRef = store.docRefs[0];
    expect(createdDocRef.type?.coding).toEqual([
      { system: 'http://loinc.org', code: RADIOLOGY_REPORT_CODE, display: 'Diagnostic imaging study' },
      RADIOLOGY_RESULT_DOC_REF_DOCTYPE,
    ]);
    expect(isCurrentRadiologyResultDocRef(createdDocRef, SERVICE_REQUEST_ID)).toBe(true);
  });

  it('files into the folder materialized for a patient created before Radiology Reports existed', async () => {
    installFakeFhir({});

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'List',
        title: BUCKET_NAMES.RADIOLOGY_REPORTS,
        subject: { reference: `Patient/${PATIENT_ID}` },
      }),
      expect.anything()
    );
    expect(folderReferences('created-radiology-reports-folder')).toEqual(['DocumentReference/new-result-doc-ref-1']);
  });

  it('replaces a same-name result in the folder and keeps the replaced document as superseded', async () => {
    installFakeFhir({
      docRefs: [makeResultDocRef({ id: 'previous-result', url: z3Url('previous.pdf') })],
      folders: [makeRadiologyReportsFolder(['DocumentReference/previous-result'])],
    });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(docRefStatus('previous-result')).toBe('superseded');
    expect(folderReferences()).toEqual(['DocumentReference/new-result-doc-ref-1']);
  });

  it('keeps unrelated folder entries, including same-name results of other orders', async () => {
    installFakeFhir({
      docRefs: [
        makeResultDocRef({ id: 'previous-result', url: z3Url('previous.pdf') }),
        makeResultDocRef({ id: 'other-name-result', url: z3Url('other.pdf'), title: 'other-report.pdf' }),
        makeResultDocRef({
          id: 'other-order-result',
          url: z3Url('other-order.pdf'),
          serviceRequestId: OTHER_SERVICE_REQUEST_ID,
        }),
      ],
      folders: [
        makeRadiologyReportsFolder([
          'DocumentReference/other-name-result',
          'DocumentReference/previous-result',
          'DocumentReference/manually-filed-doc',
          'DocumentReference/other-order-result',
        ]),
      ],
    });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(folderReferences()).toEqual([
      'DocumentReference/other-name-result',
      'DocumentReference/manually-filed-doc',
      'DocumentReference/other-order-result',
      'DocumentReference/new-result-doc-ref-1',
    ]);
    expect(docRefStatus('other-name-result')).toBe('current');
    expect(docRefStatus('other-order-result')).toBe('current');
  });

  it('files a differently named result as a separate document', async () => {
    installFakeFhir({
      docRefs: [makeResultDocRef({ id: 'other-name-result', url: z3Url('other.pdf'), title: 'other-report.pdf' })],
      folders: [makeRadiologyReportsFolder(['DocumentReference/other-name-result'])],
    });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(docRefStatus('other-name-result')).toBe('current');
    expect(folderReferences()).toEqual([
      'DocumentReference/other-name-result',
      'DocumentReference/new-result-doc-ref-1',
    ]);
  });

  it('reuses an identical stored result that is already filed without touching the folder', async () => {
    installFakeFhir({
      docRefs: [makeResultDocRef({ id: 'existing-result' })],
      folders: [makeRadiologyReportsFolder(['DocumentReference/existing-result'])],
    });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: 'existing-result' });
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    expect(store.folderPatchAttempts).toBe(0);
    expect(folderReferences()).toEqual(['DocumentReference/existing-result']);
  });

  it('files a reused identical result that is missing from the folder', async () => {
    installFakeFhir({
      docRefs: [makeResultDocRef({ id: 'existing-result' })],
      folders: [makeRadiologyReportsFolder(['DocumentReference/manually-filed-doc'])],
    });

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: 'existing-result' });
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    expect(folderReferences()).toEqual(['DocumentReference/manually-filed-doc', 'DocumentReference/existing-result']);
  });

  it('fails without retrying when the folder write fails, and repairs the folder when the upload is retried', async () => {
    installFakeFhir({ folders: [makeRadiologyReportsFolder()] });
    store.folderPatchFailures = [500];

    const failed = await uploadRadiologyResult(makeInput());

    expect(failed.statusCode).toBe(500);
    expect(store.folderPatchAttempts).toBe(1);
    expect(store.docRefs.map((docRef) => docRef.id)).toEqual(['new-result-doc-ref-1']);
    expect(folderReferences()).toEqual([]);

    const retried = await uploadRadiologyResult(makeInput());

    expect(retried.statusCode).toBe(200);
    expect(JSON.parse(retried.body)).toEqual({ documentReferenceId: 'new-result-doc-ref-1' });
    expect(store.docRefs).toHaveLength(1);
    expect(folderReferences()).toEqual(['DocumentReference/new-result-doc-ref-1']);
  });

  it('removes the replaced result when retrying a replacement whose folder write failed', async () => {
    installFakeFhir({
      docRefs: [makeResultDocRef({ id: 'previous-result', url: z3Url('previous.pdf') })],
      folders: [makeRadiologyReportsFolder(['DocumentReference/previous-result'])],
    });
    store.folderPatchFailures = [500];

    const failed = await uploadRadiologyResult(makeInput());

    expect(failed.statusCode).toBe(500);
    expect(docRefStatus('previous-result')).toBe('superseded');
    expect(folderReferences()).toEqual(['DocumentReference/previous-result']);

    const retried = await uploadRadiologyResult(makeInput());

    expect(retried.statusCode).toBe(200);
    expect(JSON.parse(retried.body)).toEqual({ documentReferenceId: 'new-result-doc-ref-1' });
    expect(folderReferences()).toEqual(['DocumentReference/new-result-doc-ref-1']);
    expect(docRefStatus('previous-result')).toBe('superseded');
  });

  it('keeps both entries when uploads for two orders of the same patient overlap', async () => {
    installFakeFhir({ folders: [makeRadiologyReportsFolder(['DocumentReference/manually-filed-doc'])] });

    const [first, second] = await Promise.all([
      uploadRadiologyResult(makeInput(SERVICE_REQUEST_ID, z3Url('first-order.pdf'), 'first-order.pdf')),
      uploadRadiologyResult(makeInput(OTHER_SERVICE_REQUEST_ID, z3Url('second-order.pdf'), 'second-order.pdf')),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const uploadedReferences = [first, second].map(
      (result) => `DocumentReference/${JSON.parse(result.body).documentReferenceId}`
    );
    expect(folderReferences()).toEqual(
      expect.arrayContaining(['DocumentReference/manually-filed-doc', ...uploadedReferences])
    );
    expect(folderReferences()).toHaveLength(3);
    expect(store.versionConflicts).toBeGreaterThan(0);
  });

  it('gives up after a bounded number of version conflicts instead of reporting success', async () => {
    installFakeFhir({ folders: [makeRadiologyReportsFolder()] });
    store.folderPatchFailures = [412, 412, 412, 412];

    const result = await uploadRadiologyResult(makeInput());

    expect(result.statusCode).toBe(500);
    expect(store.folderPatchAttempts).toBe(3);
    expect(folderReferences()).toEqual([]);
  });
});

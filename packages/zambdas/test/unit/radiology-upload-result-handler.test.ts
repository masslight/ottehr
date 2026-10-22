import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List, ServiceRequest } from 'fhir/r4b';
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
import { index as uploadRadiologyResultRaw } from '../../src/ehr/radiology/upload-result/index';

const uploadRadiologyResult = uploadRadiologyResultRaw as unknown as ZambdaHandler;

const PATIENT_ID = 'patient-1';
const SERVICE_REQUEST_ID = 'service-request-1';
const Z3_URL = `https://project-api.example.com/z3/project-1-patient-photos/${PATIENT_ID}/knee-xray.pdf`;
const FILE_TITLE = 'knee-xray.pdf';

const secrets = {
  AUTH0_ENDPOINT: 'https://auth.example.com',
  AUTH0_CLIENT: 'client',
  AUTH0_SECRET: 'secret',
  AUTH0_AUDIENCE: 'audience',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ENVIRONMENT: 'local',
};

const input: ZambdaInput = {
  headers: { Authorization: 'Bearer caller-token' },
  body: JSON.stringify({ serviceRequestId: SERVICE_REQUEST_ID, z3URL: Z3_URL, title: FILE_TITLE }),
  secrets,
};

const serviceRequest: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: SERVICE_REQUEST_ID,
  status: 'active',
  intent: 'order',
  subject: { reference: `Patient/${PATIENT_ID}` },
  encounter: { reference: 'Encounter/encounter-1' },
};

const makeRadiologyReportsFolder = (entry: List['entry'] = []): List => ({
  resourceType: 'List',
  id: 'radiology-reports-folder',
  status: 'current',
  mode: 'working',
  title: BUCKET_NAMES.RADIOLOGY_REPORTS,
  code: { coding: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: PATIENT_FOLDERS_CODE }] },
  subject: { reference: `Patient/${PATIENT_ID}` },
  entry,
});

const makeResultDocRef = (id: string, url: string, title = FILE_TITLE): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  type: { coding: [RADIOLOGY_RESULT_DOC_REF_DOCTYPE] },
  subject: { reference: `Patient/${PATIENT_ID}` },
  context: { related: [{ reference: `ServiceRequest/${SERVICE_REQUEST_ID}` }] },
  content: [{ attachment: { url, title } }],
});

const makeFolderEntry = (docRefId: string): NonNullable<List['entry']>[number] => ({
  date: '2026-10-01T00:00:00.000Z',
  item: { type: 'DocumentReference', reference: `DocumentReference/${docRefId}` },
});

const newResultEntry = {
  date: expect.any(String),
  item: { type: 'DocumentReference', reference: 'DocumentReference/new-result-doc-ref' },
};

const mockFhirStore = ({
  folders,
  currentResultDocRefs = [],
}: {
  folders: List[];
  currentResultDocRefs?: DocumentReference[];
}): void => {
  mockOystehr.fhir.get.mockImplementation(({ resourceType }: { resourceType: string }) =>
    Promise.resolve(
      resourceType === 'ServiceRequest'
        ? serviceRequest
        : { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Pat'], family: 'Provider' }] }
    )
  );
  mockOystehr.fhir.search.mockImplementation(({ resourceType }: { resourceType: string }) =>
    Promise.resolve({ unbundle: () => (resourceType === 'List' ? folders : currentResultDocRefs) })
  );
  mockOystehr.fhir.create.mockImplementation((resource: List) =>
    Promise.resolve({ ...resource, id: 'created-radiology-reports-folder' })
  );
  mockOystehr.fhir.transaction.mockImplementation(({ requests }: { requests: { resource: DocumentReference }[] }) =>
    Promise.resolve({ entry: [{ resource: { ...requests[0].resource, id: 'new-result-doc-ref' } }] })
  );
  mockOystehr.fhir.patch.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) =>
    Promise.resolve({ resourceType, id })
  );
};

interface PatchRequest {
  resourceType: string;
  id: string;
  operations: { op: string; path: string; value?: unknown }[];
}

const listPatches = (): PatchRequest[] =>
  mockOystehr.fhir.patch.mock.calls
    .map((call) => call[0] as PatchRequest)
    .filter((request) => request.resourceType === 'List');

describe('radiology-upload-result handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserMe.mockResolvedValue({ profile: 'Practitioner/practitioner-1' });
  });

  it('files the uploaded result into the patient Radiology Reports folder', async () => {
    mockFhirStore({ folders: [makeRadiologyReportsFolder()] });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: 'new-result-doc-ref' });
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(listPatches()).toEqual([
      {
        resourceType: 'List',
        id: 'radiology-reports-folder',
        operations: [{ op: 'add', path: '/entry', value: [newResultEntry] }],
      },
    ]);
  });

  it('creates the Radiology Reports folder for a patient that does not have one yet', async () => {
    mockFhirStore({ folders: [] });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'List',
        title: BUCKET_NAMES.RADIOLOGY_REPORTS,
        subject: { reference: `Patient/${PATIENT_ID}` },
      }),
      {
        ifNoneExist: [
          { name: 'subject', value: `Patient/${PATIENT_ID}` },
          { name: 'identifier', value: BUCKET_NAMES.RADIOLOGY_REPORTS },
        ],
      }
    );
    expect(listPatches()).toHaveLength(1);
    expect(listPatches()[0].id).toBe('created-radiology-reports-folder');
  });

  it('replaces a same-name result in the folder and keeps the replaced document as superseded', async () => {
    mockFhirStore({
      folders: [makeRadiologyReportsFolder([makeFolderEntry('previous-result-doc-ref')])],
      currentResultDocRefs: [makeResultDocRef('previous-result-doc-ref', `${Z3_URL}.old`)],
    });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'related', value: `ServiceRequest/${SERVICE_REQUEST_ID}` },
        {
          name: 'type',
          value: `${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system}|${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code}`,
        },
      ],
    });
    expect(mockOystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      id: 'previous-result-doc-ref',
      operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
    });
    expect(listPatches()).toEqual([
      {
        resourceType: 'List',
        id: 'radiology-reports-folder',
        operations: [{ op: 'add', path: '/entry', value: [newResultEntry] }],
      },
    ]);
  });

  it('keeps other folder entries in place when one result is replaced', async () => {
    const otherResultEntry = makeFolderEntry('other-result-doc-ref');
    const unrelatedEntry = makeFolderEntry('manually-filed-doc-ref');
    mockFhirStore({
      folders: [
        makeRadiologyReportsFolder([otherResultEntry, makeFolderEntry('previous-result-doc-ref'), unrelatedEntry]),
      ],
      currentResultDocRefs: [
        makeResultDocRef('other-result-doc-ref', `${Z3_URL}.other`, 'other-report.pdf'),
        makeResultDocRef('previous-result-doc-ref', `${Z3_URL}.old`),
      ],
    });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(listPatches()).toEqual([
      {
        resourceType: 'List',
        id: 'radiology-reports-folder',
        operations: [{ op: 'replace', path: '/entry', value: [otherResultEntry, unrelatedEntry, newResultEntry] }],
      },
    ]);
  });

  it('files a differently named result as a separate document', async () => {
    const otherResultEntry = makeFolderEntry('other-result-doc-ref');
    mockFhirStore({
      folders: [makeRadiologyReportsFolder([otherResultEntry])],
      currentResultDocRefs: [makeResultDocRef('other-result-doc-ref', `${Z3_URL}.other`, 'other-report.pdf')],
    });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'DocumentReference' })
    );
    expect(listPatches()).toEqual([
      {
        resourceType: 'List',
        id: 'radiology-reports-folder',
        operations: [{ op: 'replace', path: '/entry', value: [otherResultEntry, newResultEntry] }],
      },
    ]);
  });

  it('reuses the stored result when the identical file is uploaded again', async () => {
    mockFhirStore({
      folders: [makeRadiologyReportsFolder([makeFolderEntry('existing-result-doc-ref')])],
      currentResultDocRefs: [makeResultDocRef('existing-result-doc-ref', Z3_URL)],
    });

    const result = await uploadRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: 'existing-result-doc-ref' });
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });
});

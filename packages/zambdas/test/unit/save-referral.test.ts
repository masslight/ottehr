import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Encounter, List, Organization, Patient, ServiceRequest, Task } from 'fhir/r4b';
import { BUCKET_NAMES, TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { makeReferralServiceRequest } from 'utils/lib/fhir/referral';
import { REFERRAL_TASK, SaveReferralInput } from 'utils/lib/types/api/referrals/referrals.types';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { FAX_PACKET_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFERRAL_DOCUMENT_REJECTED_MESSAGE } from '../../src/shared/referrals/referral-documents';
import type { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockGetOrCreateReferralForm, mockCaptureException, mockBuildReferralDTOs } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: { get: vi.fn(), search: vi.fn(), create: vi.fn(), update: vi.fn(), patch: vi.fn(), transaction: vi.fn() },
  },
  mockGetOrCreateReferralForm: vi.fn(),
  mockCaptureException: vi.fn(),
  mockBuildReferralDTOs: vi.fn(),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  requireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../src/shared/practitioners', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  userPractitionerRef: vi.fn().mockResolvedValue({ reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }),
}));

vi.mock('../../src/ehr/referrals/shared', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, (...args: unknown[]) => unknown>;
  mockBuildReferralDTOs.mockImplementation(original.buildReferralDTOs);
  return { ...original, buildReferralDTOs: (...args: unknown[]) => mockBuildReferralDTOs(...args) };
});

vi.mock('../../src/shared/referrals/referral-form', () => ({
  getOrCreateReferralForm: (...args: unknown[]) => mockGetOrCreateReferralForm(...args),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { index as rawIndex } from '../../src/ehr/referrals/save-referral';
import { userPractitionerRef } from '../../src/shared/practitioners';

const saveReferral = rawIndex as unknown as ZambdaHandler;

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PATIENT_ID = '99999999-9999-4999-8999-999999999999';
const ENCOUNTER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ENCOUNTER_ID = '55555555-5555-4555-8555-555555555555';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-11-01T15:00:00.000Z';

const body: SaveReferralInput = {
  patientId: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  specialty: 'Orthopedics',
  reason: 'Distal radius fracture',
  urgency: 'urgent',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: false,
  includeDocuments: [],
};

const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Maya'], family: 'Example' }] };
const encounterOf = (patientId: string, id = ENCOUNTER_ID): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: `Patient/${patientId}` },
});

const existingReferral = (patientId: string, encounterId?: string): ServiceRequest => {
  const base = makeReferralServiceRequest(
    { ...body, patientId, encounterId },
    { patientId, encounterId, requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }, now: NOW }
  );
  return { ...base, id: REFERRAL_ID, meta: { ...base.meta, versionId: '2' } };
};

const run = async (input: Partial<SaveReferralInput>): Promise<APIGatewayProxyResult> =>
  saveReferral(createMockZambdaInput({ ...body, ...input }, { secrets: createMockSecrets() }));

interface TransactionRequest {
  method: string;
  url: string;
  resource: any;
  ifMatch?: string;
  fullUrl?: string;
}
const transactionRequests = (): TransactionRequest[] => mockOystehr.fhir.transaction.mock.calls[0][0].requests;
const writtenReferral = (): ServiceRequest => transactionRequests()[0].resource;
const writtenTask = (): TransactionRequest | undefined =>
  transactionRequests().find((request) => request.url.startsWith('/Task'));
const expectNothingWrittenOutsideTheTransaction = (): void => {
  expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
};

describe('save-referral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
    mockOystehr.fhir.transaction.mockImplementation(async ({ requests }: { requests: TransactionRequest[] }) => ({
      entry: requests.map((request) => ({
        resource:
          request.method === 'PATCH'
            ? undefined
            : {
                ...request.resource,
                id: request.resource.id ?? (request.url === '/ServiceRequest' ? REFERRAL_ID : 'task-new'),
                meta: { ...request.resource.meta, versionId: '3' },
              },
      })),
    }));
    mockGetOrCreateReferralForm.mockResolvedValue({
      documentReference: { resourceType: 'DocumentReference', id: 'form-1' },
      z3Url: 'z3://referrals/form.pdf',
    });
  });

  const contact: Organization = {
    resourceType: 'Organization',
    id: CONTACT_ID,
    meta: { tag: [{ system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }] },
    name: 'Riverside Orthopedic Associates',
    telecom: [{ system: 'fax', value: '(555) 014-2277' }],
  };

  const reads = (resources: { encounter?: Encounter; referral?: ServiceRequest }): void => {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Patient') return patient;
      if (resourceType === 'Organization') return contact;
      if (resourceType === 'Encounter' && resources.encounter) return resources.encounter;
      if (resourceType === 'ServiceRequest' && resources.referral) return resources.referral;
      throw new Error(`unexpected get for ${resourceType}`);
    });
  };

  it('rejects a fax that is not a phone number before reading anything', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({ recipientContactId: CONTACT_ID, recipientFax: 'call me' });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(JSON.parse(result.body).message).toContain('recipientFax');
    expect(mockOystehr.fhir.get).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('SECURITY: refuses a visit that belongs to another patient before writing anything', async () => {
    reads({ encounter: encounterOf(OTHER_PATIENT_ID) });

    const result = await run({});

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: 'Visit does not belong to this patient',
    });
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it("SECURITY: reports another patient's referral as not found rather than editing it", async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(OTHER_PATIENT_ID, ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
      message: `Referral ${REFERRAL_ID} not found`,
    });
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('refuses to move a referral to another visit', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, OTHER_ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('The visit of a referral cannot change');
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('updates an existing referral against the version it read', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID, reason: 'Fracture, follow-up imaging' });

    expect(result.statusCode).toBe(200);
    const [put] = transactionRequests();
    expect(put).toMatchObject({ method: 'PUT', url: `/ServiceRequest/${REFERRAL_ID}`, ifMatch: 'W/"2"' });
    expect(put.resource.reasonCode[0].text).toBe('Fracture, follow-up imaging');
    expectNothingWrittenOutsideTheTransaction();
  });

  it('assigns a task created by an edit to the referring provider, not to whoever saved the edit', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });
    vi.mocked(userPractitionerRef).mockResolvedValueOnce({
      reference: 'Practitioner/staff-1',
      display: 'Sam Staff',
    });

    const result = await run({ referralId: REFERRAL_ID, recipientContactId: CONTACT_ID, responseRequested: true });

    expect(result.statusCode).toBe(200);
    const task: Task | undefined = writtenTask()?.resource;
    expect(task?.owner).toMatchObject({ reference: 'Practitioner/prac-1' });
  });

  it('reports a concurrent edit as a precondition failure', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });
    mockOystehr.fhir.transaction.mockRejectedValue(Object.assign(new Error('conflict'), { code: 412 }));

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.PRECONDITION_FAILED);
  });

  it('does not generate the form on save; preview and fax generate it on demand', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({});

    expect(result.statusCode).toBe(200);
    expect(mockGetOrCreateReferralForm).not.toHaveBeenCalled();
  });

  it('builds the response from what the save loaded, without reading the recipient or the visit again', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({ recipientContactId: CONTACT_ID, recipientFax: '(555) 010-2000' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral.recipient).toMatchObject({
      contactId: CONTACT_ID,
      name: 'Riverside Orthopedic Associates',
      fax: '(555) 010-2000',
    });
    const readTypes = mockOystehr.fhir.get.mock.calls.map(([{ resourceType }]) => resourceType);
    expect(readTypes.filter((type) => type === 'Organization')).toHaveLength(1);
    expect(readTypes.filter((type) => type === 'Encounter')).toHaveLength(1);
    const searched = mockOystehr.fhir.search.mock.calls.map(([{ resourceType }]) => resourceType);
    expect(searched).not.toContain('Organization');
    expect(searched).not.toContain('Encounter');
  });

  it('creates no awaiting task when a response is asked for without a recipient to fax', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({ responseRequested: true });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral.responseRequested).toBe(false);
    expect(transactionRequests().map(({ method, url }) => `${method} ${url}`)).toEqual(['POST /ServiceRequest']);
  });

  it('stores no visit documents for a referral without a visit', async () => {
    reads({});

    const result = await run({ encounterId: undefined, includeDocuments: ['progress-note'] });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral.includeDocuments).toEqual([]);
  });

  it('creates a new referral and its awaiting task in one transaction, the task pointing at the new referral', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({ recipientContactId: CONTACT_ID, responseRequested: true });

    expect(result.statusCode).toBe(200);
    const [post, taskPost, ...rest] = transactionRequests();
    expect(rest).toHaveLength(0);
    expect(post).toMatchObject({
      method: 'POST',
      url: '/ServiceRequest',
      fullUrl: expect.stringMatching(/^urn:uuid:/),
    });
    expect(taskPost).toMatchObject({ method: 'POST', url: '/Task' });
    expect(taskPost.resource.basedOn).toEqual([{ reference: post.fullUrl }]);
    expect(JSON.parse(result.body).referral).toMatchObject({ id: REFERRAL_ID, status: 'not-sent' });
    expectNothingWrittenOutsideTheTransaction();
  });

  it('fails the save and leaves nothing behind when the referral or its task cannot be written, so a retry is safe', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });
    mockOystehr.fhir.transaction.mockRejectedValue(new Error('Task create failed'));

    const result = await run({ recipientContactId: CONTACT_ID, responseRequested: true });

    expect(result.statusCode).toBe(500);
    expectNothingWrittenOutsideTheTransaction();
  });

  describe('an edited referral with an open task', () => {
    const openTask: Task = {
      resourceType: 'Task',
      id: 'task-1',
      meta: { versionId: '5' },
      status: 'in-progress',
      intent: 'order',
      authoredOn: NOW,
      groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
      basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }],
    };

    beforeEach(() => {
      reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });
      mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
        unbundle: () => (resourceType === 'Task' ? [openTask] : []),
      }));
    });

    // A close landing between the reads and this transaction changes the referral's version, so the whole
    // save fails instead of reopening or recreating the task the close settled.
    it("refreshes the task in the referral's transaction, against the version of each", async () => {
      const result = await run({ referralId: REFERRAL_ID, recipientContactId: CONTACT_ID, responseRequested: true });

      expect(result.statusCode).toBe(200);
      expect(transactionRequests().map(({ method, url, ifMatch }) => ({ method, url, ifMatch }))).toEqual([
        { method: 'PUT', url: `/ServiceRequest/${REFERRAL_ID}`, ifMatch: 'W/"2"' },
        { method: 'PUT', url: '/Task/task-1', ifMatch: 'W/"5"' },
      ]);
      expectNothingWrittenOutsideTheTransaction();
    });

    it("cancels the task in the referral's transaction when a response is no longer requested", async () => {
      const result = await run({ referralId: REFERRAL_ID, responseRequested: false });

      expect(result.statusCode).toBe(200);
      expect(transactionRequests().map(({ method, url }) => `${method} ${url}`)).toEqual([
        `PUT /ServiceRequest/${REFERRAL_ID}`,
        'PATCH /Task/task-1',
      ]);
      expectNothingWrittenOutsideTheTransaction();
    });
  });

  it('falls back to the saved ServiceRequest alone when the full response cannot be built', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });
    const failure = new Error('Task search failed');
    mockBuildReferralDTOs.mockRejectedValueOnce(failure);

    const result = await run({});

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral).toMatchObject({
      id: REFERRAL_ID,
      status: 'not-sent',
      reason: 'Distal radius fracture',
    });
    expect(mockOystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(failure);
  });

  it('creates the awaiting task for the referring provider at the visit location', async () => {
    const location = { resourceType: 'Location', id: 'loc-1', name: 'Main Street' };
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Patient') return patient;
      if (resourceType === 'Organization') return contact;
      if (resourceType === 'Location') return location;
      if (resourceType === 'Encounter') {
        return { ...encounterOf(PATIENT_ID), location: [{ location: { reference: 'Location/loc-1' } }] };
      }
      throw new Error(`unexpected get for ${resourceType}`);
    });

    const result = await run({ recipientContactId: CONTACT_ID, responseRequested: true });

    expect(result.statusCode).toBe(200);
    const task: Task | undefined = writtenTask()?.resource;
    expect(task).toMatchObject({
      code: { coding: [{ code: REFERRAL_TASK.code.awaitResponse }] },
      location: { reference: 'Location/loc-1', display: 'Main Street' },
      owner: expect.objectContaining({ reference: 'Practitioner/prac-1' }),
    });
  });

  describe('earlier-visit documents', () => {
    const DOCUMENT_ID = '66666666-6666-4666-8666-666666666666';
    const visitNote: DocumentReference = {
      resourceType: 'DocumentReference',
      id: DOCUMENT_ID,
      status: 'current',
      subject: { reference: `Patient/${PATIENT_ID}` },
      content: [{ attachment: { url: 'z3://visit-notes/note.pdf', title: 'VisitNote.pdf' } }],
    };
    const folderOf = (title: string): List => ({
      resourceType: 'List',
      id: `list-${title}`,
      status: 'current',
      mode: 'working',
      title,
      code: { coding: [{ code: PATIENT_FOLDERS_CODE }] },
      entry: [{ item: { reference: `DocumentReference/${DOCUMENT_ID}` } }],
    });

    /** The FHIR search, scoped by `subject` the way the server scopes it. */
    const filed = (document: DocumentReference, folderTitle: string): void => {
      mockOystehr.fhir.search.mockImplementation(
        async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
          const byId = params.some((param) => param.name === '_id' && param.value.includes(DOCUMENT_ID));
          const subject = params.find((param) => param.name === 'subject')?.value;
          if (resourceType === 'DocumentReference' && byId && document.subject?.reference === subject) {
            return { unbundle: () => [document] };
          }
          if (resourceType === 'List' && subject === `Patient/${PATIENT_ID}`) {
            return { unbundle: () => [folderOf(folderTitle)] };
          }
          return { unbundle: () => [] };
        }
      );
    };

    it('stores the chosen documents as supportingInfo, once each, and returns them for the chips', async () => {
      reads({ encounter: encounterOf(PATIENT_ID) });
      filed(visitNote, BUCKET_NAMES.VISIT_NOTES);

      const result = await run({ earlierDocumentIds: [DOCUMENT_ID, DOCUMENT_ID] });

      expect(result.statusCode).toBe(200);
      expect(writtenReferral().supportingInfo).toEqual([{ reference: `DocumentReference/${DOCUMENT_ID}` }]);
      expect(JSON.parse(result.body).referral.earlierDocuments).toEqual([{ id: DOCUMENT_ID, title: 'VisitNote.pdf' }]);
    });

    it.each([
      [
        "another patient's document",
        { ...visitNote, subject: { reference: `Patient/${OTHER_PATIENT_ID}` } },
        BUCKET_NAMES.VISIT_NOTES,
      ],
      ['a fax packet', { ...visitNote, type: { coding: [{ code: FAX_PACKET_CODE }] } }, BUCKET_NAMES.VISIT_NOTES],
      ['a document in a folder referrals do not send from', visitNote, BUCKET_NAMES.CONSENT_FORMS],
      ['a Labs document that is not a result', visitNote, BUCKET_NAMES.LABS],
    ])('SECURITY: refuses %s with one generic message before writing anything', async (_case, document, folder) => {
      reads({ encounter: encounterOf(PATIENT_ID) });
      filed(document as DocumentReference, folder);

      const result = await run({ earlierDocumentIds: [DOCUMENT_ID] });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        code: APIErrorCode.INVALID_INPUT,
        message: REFERRAL_DOCUMENT_REJECTED_MESSAGE,
      });
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });

    it('refuses more than 50 documents at validation', async () => {
      reads({ encounter: encounterOf(PATIENT_ID) });
      const ids = Array.from({ length: 51 }, (_, i) => `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`);

      const result = await run({ earlierDocumentIds: ids });

      expect(result.statusCode).toBe(400);
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    });
  });
});

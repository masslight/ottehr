import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, FhirResource, Location, Organization, Practitioner, Task } from 'fhir/r4b';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import {
  makeReferralServiceRequest,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
  withReferralDetails,
} from 'utils/lib/fhir/referral';
import { AdHocReferralsOutputSchema } from 'utils/lib/types/adhoc/datasets/referrals';
import { REFERRAL_TASK } from 'utils/lib/types/api/referrals/referrals.types';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { fetchAdHocReferralRows } from '../../src/shared/adhoc-datasets/referrals';

// Same shape as adhoc-datasets-fixture.test.ts: the fetch+map pipeline runs against a stubbed Oystehr client and
// the mapped rows must parse with the endpoint's own Output schema.

const referral = withReferralDetails(
  makeReferralServiceRequest(
    {
      patientId: 'pat-1',
      encounterId: 'enc-1',
      specialty: 'Orthopedics',
      recipientContactId: 'org-1',
      reason: 'Persistent knee pain after fall',
      urgency: 'urgent',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      includeDocuments: [],
    },
    {
      patientId: 'pat-1',
      encounterId: 'enc-1',
      requester: { reference: 'Practitioner/prac-1', display: 'J. Rivera, MD' },
      recipientDisplay: 'Riverside Orthopedic Associates',
      existing: { resourceType: 'ServiceRequest', id: 'sr-1', status: 'draft', intent: 'order', subject: {} },
      now: '2026-10-23T15:00:00.000Z',
    }
  ),
  { status: 'response-received', sentAt: '2026-10-23T15:05:00.000Z' }
);

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appt-1' }],
  location: [{ location: { reference: 'Location/loc-1' } }],
};
const location: Location = { resourceType: 'Location', id: 'loc-1', name: 'Springfield' };
const organization: Organization = {
  resourceType: 'Organization',
  id: 'org-1',
  name: 'Riverside Orthopedic Associates',
  meta: { tag: [{ system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }] },
};
const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Jon'], family: 'Rivera' }],
};
// A filed response relates to the ServiceRequest like the form does; the form is told apart by its type.
const responseDocument: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-1',
  status: 'current',
  date: '2026-10-30T15:05:00.000Z',
  context: { related: [{ reference: 'ServiceRequest/sr-1' }] },
  content: [],
};
const formDocument: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'form-1',
  status: 'current',
  date: '2026-10-23T15:01:00.000Z',
  type: { coding: [{ ...REFERRAL_FORM_DOC_REF_DOCTYPE }] },
  context: { related: [{ reference: 'ServiceRequest/sr-1' }] },
  content: [],
};
const task: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  authoredOn: '2026-10-23T15:00:00.000Z',
  groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
  basedOn: [{ reference: 'ServiceRequest/sr-1' }],
  owner: { reference: 'Practitioner/prac-1', display: 'J. Rivera, MD' },
  restriction: { period: { end: '2026-10-30T15:00:00.000Z' } },
};

const scopedByType: Record<string, FhirResource[]> = {
  Encounter: [encounter],
  Location: [location],
  Organization: [organization],
  Practitioner: [practitioner],
  DocumentReference: [formDocument, responseDocument],
  Task: [task],
};

const ndjsonByUrl = new Map<string, string>();
const manifestFor = (jobId: string): { output: { type: string; url: string }[]; requiresAccessToken: boolean } => {
  const resources = scopedByType[jobId] ?? [];
  const url = `https://example.test/${jobId}.ndjson`;
  ndjsonByUrl.set(url, resources.map((resource) => JSON.stringify(resource)).join('\n'));
  return { output: resources.length ? [{ type: jobId, url }] : [], requiresAccessToken: true };
};

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const ndjson = ndjsonByUrl.get(String(input));
  if (ndjson === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => ndjson };
}) as unknown as typeof fetch);

afterAll(() => vi.unstubAllGlobals());

// The referral search is a plain paged search (getAllFhirSearchPages); the related resources go through the
// async-bulk path (fetchScopedResources).
const fakeOystehr = {
  fhir: {
    search: vi.fn(async ({ resourceType }: { resourceType: string }, options?: { mode?: string }) => {
      if (options?.mode === 'async-bulk') return { jobId: resourceType, contentLocation: '', mode: 'bulk' };
      const resources = resourceType === 'ServiceRequest' ? [referral] : [];
      return {
        total: resources.length,
        entry: resources.map((resource) => ({ resource, search: { mode: 'match' } })),
        unbundle: () => resources,
      };
    }),
    waitForAsyncJob: async (jobId: string) => ({ status: 200, mode: 'bulk', manifest: manifestFor(jobId) }),
  },
} as unknown as Oystehr;

const dateRange = { start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' };

describe('ad-hoc referrals dataset: mapped rows parse against the Zod schema (fixture)', () => {
  it('base + task layer rows match the schema with key values resolved', async () => {
    const rows = await fetchAdHocReferralRows(fakeOystehr, { dateRange, includeTask: true });
    const parsed = AdHocReferralsOutputSchema.safeParse({ referrals: rows });
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      referralId: 'sr-1',
      patientId: 'pat-1',
      encounterId: 'enc-1',
      appointmentId: 'appt-1',
      locationId: 'loc-1',
      locationName: 'Springfield',
      specialty: 'Orthopedics',
      recipientContactId: 'org-1',
      recipientName: 'Riverside Orthopedic Associates',
      referringProviderId: 'prac-1',
      referringProviderName: 'Jon Rivera',
      urgency: 'urgent',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      status: 'response-received',
      createdAt: '2026-10-23T15:00:00.000Z',
      sentAt: '2026-10-23T15:05:00.000Z',
      responseReceivedAt: '2026-10-30T15:05:00.000Z',
      closedAt: null,
      closeReason: null,
      daysSentToResponse: 7,
      taskId: 'task-1',
      taskStatus: 'in-progress',
      overdueAt: '2026-10-30T15:00:00.000Z',
      assignee: 'J. Rivera, MD',
    });
  });

  it('leaves the task layer off when it was not requested', async () => {
    const rows = await fetchAdHocReferralRows(fakeOystehr, { dateRange, includeTask: false });
    expect(rows[0]).not.toHaveProperty('taskId');
    expect(AdHocReferralsOutputSchema.safeParse({ referrals: rows }).success).toBe(true);
  });
});

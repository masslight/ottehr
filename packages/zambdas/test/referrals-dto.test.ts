import type Oystehr from '@oystehr/sdk';
import type {
  Communication,
  DocumentReference,
  Encounter,
  FhirResource,
  Organization,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import {
  OUTBOUND_DELIVERY_OUTPUT_CODES,
  OUTBOUND_DELIVERY_OUTPUT_SYSTEM,
  OUTBOUND_DELIVERY_TASK_CODES,
  OUTBOUND_DELIVERY_TASK_SYSTEM,
  OYSTEHR_OUTBOUND_FAX_STATUS_CODES,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
  TASK_CATEGORY_IDENTIFIER,
} from 'utils/lib/fhir/constants';
import {
  makeReferralServiceRequest,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
  withReferralDetails,
} from 'utils/lib/fhir/referral';
import { REFERRAL_TASK, SaveReferralInput } from 'utils/lib/types/api/referrals/referrals.types';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { describe, expect, it } from 'vitest';
import { buildReferralDTOs, pickReferralTask, sortReferrals, toReferralDTO } from '../src/ehr/referrals/shared';
import { mapReferralRecipient } from '../src/shared/referrals/recipient';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-11-01T15:00:00.000Z';

const input: SaveReferralInput = {
  patientId: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  specialty: 'Orthopedics',
  recipientContactId: CONTACT_ID,
  reason: 'Distal radius fracture',
  urgency: 'urgent',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: true,
  includeDocuments: ['progress-note'],
};

const makeReferral = (id: string, overrides: Partial<SaveReferralInput> = {}, now = NOW): ServiceRequest => ({
  ...makeReferralServiceRequest(
    { ...input, ...overrides },
    {
      patientId: PATIENT_ID,
      encounterId: overrides.encounterId === undefined && 'encounterId' in overrides ? undefined : ENCOUNTER_ID,
      requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' },
      recipientDisplay: 'Riverside Orthopedic Associates',
      now,
    }
  ),
  id,
});

const organization: Organization = {
  resourceType: 'Organization',
  id: CONTACT_ID,
  meta: { tag: [{ system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }] },
  name: 'Riverside Orthopedic Associates',
  alias: ['Pat Lee, MD'],
  contact: [{ name: { given: ['Pat'], family: 'Lee', suffix: ['MD'] } }],
  address: [{ line: ['88 Medical Plaza', 'Suite 310'], city: 'Springfield', state: 'CA', postalCode: '90211' }],
  telecom: [
    { system: 'fax', value: '(555) 014-2277' },
    { system: 'phone', value: '(555) 014-2270' },
  ],
};

describe('mapReferralRecipient', () => {
  it('names the organization first and prints the address on one line', () => {
    expect(mapReferralRecipient(organization)).toEqual({
      contactId: CONTACT_ID,
      name: 'Riverside Orthopedic Associates',
      organizationName: 'Riverside Orthopedic Associates',
      personName: 'Pat Lee, MD',
      fax: '(555) 014-2277',
      phone: '(555) 014-2270',
      address: '88 Medical Plaza, Suite 310, Springfield, CA 90211',
    });
  });

  it('falls back to the organization name', () => {
    const orgOnly: Organization = { ...organization, alias: undefined, contact: undefined, address: undefined };
    expect(mapReferralRecipient(orgOnly)).toMatchObject({
      name: 'Riverside Orthopedic Associates',
      personName: undefined,
      address: undefined,
    });
  });
});

describe('toReferralDTO', () => {
  it('maps the ServiceRequest and its context', () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'in-progress',
      intent: 'order',
      restriction: { period: { end: '2026-11-08T15:00:00.000Z' } },
    };
    const dto = toReferralDTO(makeReferral('sr-1'), {
      recipient: mapReferralRecipient(organization),
      appointmentId: 'appt-1',
      task,
      formDocumentReference: { resourceType: 'DocumentReference', id: 'form-1', status: 'current', content: [] },
      lastFax: { attemptId: 'attempt-1', status: 'sent', sentAt: NOW },
    });

    expect(dto).toMatchObject({
      id: 'sr-1',
      patientId: PATIENT_ID,
      encounterId: ENCOUNTER_ID,
      appointmentId: 'appt-1',
      specialty: 'Orthopedics',
      recipient: { contactId: CONTACT_ID, name: 'Riverside Orthopedic Associates' },
      reason: 'Distal radius fracture',
      urgency: 'urgent',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      includeDocuments: ['progress-note'],
      referringProvider: { id: 'prac-1', name: 'Jordan Rivera, MD' },
      status: 'not-sent',
      createdAt: NOW,
      taskId: 'task-1',
      taskStatus: 'in-progress',
      overdueAt: '2026-11-08T15:00:00.000Z',
      formDocumentReferenceId: 'form-1',
      responseDocumentReferenceIds: [],
      lastFax: { attemptId: 'attempt-1', status: 'sent' },
    });
    expect(dto.notesToRecipient).toBeUndefined();
  });

  it('keeps the recipient from the stored display when the contact could not be loaded', () => {
    const dto = toReferralDTO(makeReferral('sr-1'), {});
    expect(dto.recipient).toEqual({ contactId: CONTACT_ID, name: 'Riverside Orthopedic Associates' });
    expect(toReferralDTO(makeReferral('sr-2', { recipientContactId: undefined }), {}).recipient).toBeUndefined();
  });
});

describe('sortReferrals / pickReferralTask', () => {
  it('puts open referrals first, newest first within each group', () => {
    const closed = toReferralDTO(
      withReferralDetails(makeReferral('closed', {}, '2026-11-03T00:00:00Z'), { status: 'closed' }),
      {}
    );
    const older = toReferralDTO(makeReferral('older', {}, '2026-11-01T00:00:00Z'), {});
    const newer = toReferralDTO(makeReferral('newer', {}, '2026-11-02T00:00:00Z'), {});
    expect(sortReferrals([closed, older, newer]).map((r) => r.id)).toEqual(['newer', 'older', 'closed']);
  });

  it('prefers an open task over a newer finished one', () => {
    const done: Task = {
      resourceType: 'Task',
      id: 'done',
      status: 'completed',
      intent: 'order',
      authoredOn: '2026-11-02',
    };
    const open: Task = { resourceType: 'Task', id: 'open', status: 'ready', intent: 'order', authoredOn: '2026-11-01' };
    expect(pickReferralTask([done, open])?.id).toBe('open');
    expect(pickReferralTask([done])?.id).toBe('done');
    expect(pickReferralTask([])).toBeUndefined();
  });
});

describe('buildReferralDTOs', () => {
  const referralTask: Task = {
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    intent: 'order',
    authoredOn: NOW,
    groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
    basedOn: [{ reference: 'ServiceRequest/sr-1' }],
    restriction: { period: { end: '2026-11-08T15:00:00.000Z' } },
  };
  const faxAttempt: Task = {
    resourceType: 'Task',
    id: 'attempt-1',
    status: 'in-progress',
    intent: 'order',
    authoredOn: NOW,
    code: { coding: [{ system: OUTBOUND_DELIVERY_TASK_SYSTEM, code: OUTBOUND_DELIVERY_TASK_CODES.fax }] },
    basedOn: [{ reference: 'ServiceRequest/sr-1' }],
    executionPeriod: { start: NOW },
    output: [
      {
        type: {
          coding: [{ system: OUTBOUND_DELIVERY_OUTPUT_SYSTEM, code: OUTBOUND_DELIVERY_OUTPUT_CODES.communication }],
        },
        valueReference: { reference: 'Communication/comm-1' },
      },
    ],
  };
  const communication: Communication = {
    resourceType: 'Communication',
    id: 'comm-1',
    status: 'completed',
    extension: [
      {
        url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
        valueCodeableConcept: { coding: [{ code: OYSTEHR_OUTBOUND_FAX_STATUS_CODES.delivered }] },
      },
    ],
  };
  const form: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'form-1',
    status: 'current',
    date: NOW,
    type: { coding: [REFERRAL_FORM_DOC_REF_DOCTYPE] },
    context: { related: [{ reference: 'ServiceRequest/sr-1' }] },
    content: [],
  };
  // Filed responses relate to the ServiceRequest like the form does, without its type; listed oldest first.
  const response = (id: string, date: string): DocumentReference => ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    date,
    context: { related: [{ reference: 'ServiceRequest/sr-1' }] },
    content: [],
  });
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: ENCOUNTER_ID,
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/appt-1' }],
  };

  const resourcesByType: Record<string, FhirResource[]> = {
    Organization: [organization],
    Task: [referralTask, faxAttempt],
    DocumentReference: [response('resp-2', '2026-11-05T00:00:00Z'), form, response('resp-1', '2026-11-03T00:00:00Z')],
    Encounter: [encounter],
    Communication: [communication],
    Practitioner: [{ resourceType: 'Practitioner', id: 'prac-2', name: [{ given: ['Sam'], family: 'Park' }] }],
  };
  const searches: { resourceType: string; params: { name: string; value: string }[] }[] = [];
  const oystehr = {
    fhir: {
      search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        searches.push({ resourceType, params });
        const resources = resourcesByType[resourceType] ?? [];
        return { resourceType: 'Bundle', type: 'searchset', link: [], unbundle: () => resources };
      },
    },
  } as unknown as Oystehr;

  it('loads recipient, task, form, fax and appointment in batches and sorts the result', async () => {
    const withoutDisplay = {
      ...makeReferral('sr-2', { recipientContactId: undefined }, '2026-10-30T00:00:00Z'),
      requester: { reference: 'Practitioner/prac-2' },
    };
    const notAReferral = { ...makeReferral('sr-3'), meta: {} };

    const dtos = await buildReferralDTOs(oystehr, [withoutDisplay, makeReferral('sr-1'), notAReferral]);

    expect(dtos.map((dto) => dto.id)).toEqual(['sr-1', 'sr-2']);
    expect(dtos[0]).toMatchObject({
      recipient: { name: 'Riverside Orthopedic Associates', fax: '(555) 014-2277' },
      appointmentId: 'appt-1',
      taskId: 'task-1',
      overdueAt: '2026-11-08T15:00:00.000Z',
      formDocumentReferenceId: 'form-1',
      responseDocumentReferenceIds: ['resp-1', 'resp-2'],
      lastFax: { attemptId: 'attempt-1', status: 'sent', sentAt: NOW },
    });
    expect(dtos[1]).toMatchObject({ recipient: undefined, referringProvider: { id: 'prac-2', name: 'Sam Park' } });
    expect(dtos[1].taskId).toBeUndefined();

    // Tasks of both kinds come from one based-on search; the practitioner is only fetched when the display is missing.
    const taskSearches = searches.filter((search) => search.resourceType === 'Task');
    expect(taskSearches).toHaveLength(1);
    expect(taskSearches[0].params.find((param) => param.name === 'based-on')?.value).toBe(
      'ServiceRequest/sr-2,ServiceRequest/sr-1'
    );
    expect(searches.find((search) => search.resourceType === 'Practitioner')?.params[0]).toEqual({
      name: '_id',
      value: 'prac-2',
    });
  });

  it('returns nothing for an empty list without searching', async () => {
    const before = searches.length;
    expect(await buildReferralDTOs(oystehr, [])).toEqual([]);
    expect(searches.length).toBe(before);
  });
});

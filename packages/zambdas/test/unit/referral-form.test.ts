import { DocumentReference, FhirResource, List, Organization, ServiceRequest } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import {
  REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM,
  REFERRAL_ORDER_TYPE_TAG,
  withReferralDetails,
} from 'utils/lib/fhir/referral';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets } from './validate-request-parameters/helpers';

const { mockOystehr, mockCreateReferralFormPDF, mockCaptureException } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn() } },
  mockCreateReferralFormPDF: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('../../src/shared/pdf/referral-form-pdf', () => ({
  createReferralFormPDF: (...args: unknown[]) => mockCreateReferralFormPDF(...args),
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { makeOrderFormVersion, OrderFormSource } from '../../src/shared/order-form-version';
import { getOrCreateReferralForm, REFERRAL_FORM_TEMPLATE_VERSION } from '../../src/shared/referrals/referral-form';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';

const referral: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: REFERRAL_ID,
  meta: { versionId: '3' },
  status: 'draft',
  intent: 'order',
  subject: { reference: `Patient/${PATIENT_ID}` },
};

const practice: Organization = { resourceType: 'Organization', id: 'org-1', name: 'Practice' };

const notFound = Object.assign(new Error('Not found'), { code: 404 });

describe('getOrCreateReferralForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
    mockCreateReferralFormPDF.mockResolvedValue({
      documentReference: {
        resourceType: 'DocumentReference',
        id: 'form-1',
        content: [{ attachment: { url: 'z3://referrals/form.pdf' } }],
      },
      presignedURL: 'https://signed/form.pdf',
    });
  });

  const run = (): ReturnType<typeof getOrCreateReferralForm> =>
    getOrCreateReferralForm(referral, {
      oystehr: mockOystehr as never,
      secrets: createMockSecrets(),
      token: 'token',
    });

  const gets = (organization: () => Promise<Organization | undefined>): void => {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Patient') return { resourceType: 'Patient', id: PATIENT_ID };
      if (resourceType === 'Organization') return organization();
      throw new Error(`unexpected get for ${resourceType}`);
    });
  };

  it('passes the practice to the form when ORGANIZATION_ID resolves', async () => {
    gets(async () => practice);

    const form = await run();

    expect(form.z3Url).toBe('z3://referrals/form.pdf');
    expect(mockCreateReferralFormPDF.mock.calls[0][0]).toMatchObject({ practice });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('still renders the form without the practice when ORGANIZATION_ID names no Organization, and reports it', async () => {
    gets(async () => {
      throw notFound;
    });

    const form = await run();

    expect(form.z3Url).toBe('z3://referrals/form.pdf');
    expect(mockCreateReferralFormPDF.mock.calls[0][0]).toMatchObject({ practice: undefined });
    expect(mockCaptureException).toHaveBeenCalledWith(notFound);
  });

  it('fails the form on any other practice lookup error, so an outage or lost access is not hidden', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { code: 403 });
    gets(async () => {
      throw forbidden;
    });

    await expect(run()).rejects.toBe(forbidden);
    expect(mockCreateReferralFormPDF).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe('getOrCreateReferralForm reuse of the stored form', () => {
  const versioned = <T extends FhirResource>(resource: T, versionId: string): T => ({
    ...resource,
    meta: { ...resource.meta, versionId },
  });

  const fullReferral = withReferralDetails(
    {
      resourceType: 'ServiceRequest',
      id: REFERRAL_ID,
      meta: { versionId: '7', tag: [{ ...REFERRAL_ORDER_TYPE_TAG }] },
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${PATIENT_ID}` },
      encounter: { reference: 'Encounter/encounter-1' },
      requester: { reference: 'Practitioner/practitioner-1' },
      performer: [{ reference: 'Organization/recipient-1' }],
      supportingInfo: [{ reference: 'DocumentReference/earlier-1' }],
    },
    { status: 'sent', recipientFax: '+12125550000' }
  );

  interface World {
    patient: FhirResource;
    practice: FhirResource;
    encounter: FhirResource;
    location: FhirResource;
    practitioner: FhirResource;
    recipient: FhirResource;
    earlier: FhirResource;
  }

  const initialWorld = (): World => ({
    patient: versioned({ resourceType: 'Patient', id: PATIENT_ID }, '1'),
    practice: versioned({ resourceType: 'Organization', id: 'org-123', name: 'Practice' }, '1'),
    encounter: versioned(
      {
        resourceType: 'Encounter',
        id: 'encounter-1',
        status: 'finished',
        class: { code: 'AMB' },
        location: [{ location: { reference: 'Location/location-1' } }],
      },
      '1'
    ),
    location: versioned({ resourceType: 'Location', id: 'location-1', name: 'Office' }, '1'),
    practitioner: versioned({ resourceType: 'Practitioner', id: 'practitioner-1' }, '1'),
    recipient: versioned(
      {
        resourceType: 'Organization',
        id: 'recipient-1',
        name: 'Springfield Cardiology',
        meta: { tag: [{ system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }] },
        telecom: [{ system: 'fax', value: '+12125559999' }],
      },
      '1'
    ),
    earlier: versioned(
      {
        resourceType: 'DocumentReference',
        id: 'earlier-1',
        status: 'current',
        subject: { reference: `Patient/${PATIENT_ID}` },
        content: [{ attachment: { url: 'z3://visit-notes/earlier.pdf', title: 'Visit note' } }],
      },
      '1'
    ),
  });

  const visitNotesFolder: List = {
    resourceType: 'List',
    id: 'folder-1',
    status: 'current',
    mode: 'working',
    title: BUCKET_NAMES.VISIT_NOTES,
    code: { coding: [{ code: PATIENT_FOLDERS_CODE }] },
    entry: [{ item: { reference: 'DocumentReference/earlier-1' } }],
  };

  const sourcesOf = (world: World): OrderFormSource[] => [
    fullReferral,
    world.patient,
    world.practice,
    world.location,
    world.practitioner,
    world.recipient,
    world.earlier,
  ];

  const storedForm = (version: string | undefined): DocumentReference => ({
    resourceType: 'DocumentReference',
    id: 'stored-form',
    status: 'current',
    content: [{ attachment: { url: 'z3://referrals/stored.pdf' } }],
    ...(version ? { identifier: [{ system: REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM, value: version }] } : {}),
  });

  const serve = (world: World, stored: DocumentReference): void => {
    const byId = new Map(
      [world.patient, world.practice, world.encounter, world.location, world.practitioner].map((resource) => [
        `${resource.resourceType}/${resource.id}`,
        resource,
      ])
    );
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType, id }: { resourceType: string; id: string }) => {
      const resource = byId.get(`${resourceType}/${id}`);
      if (!resource) throw new Error(`unexpected get for ${resourceType}/${id}`);
      return resource;
    });
    mockOystehr.fhir.search.mockImplementation(
      async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        const has = (name: string): boolean => params.some((param) => param.name === name);
        const found: FhirResource[] =
          resourceType === 'DocumentReference'
            ? has('related')
              ? [stored]
              : [world.earlier]
            : resourceType === 'Organization'
            ? [world.recipient]
            : resourceType === 'List'
            ? [visitNotesFolder]
            : [];
        return { unbundle: () => found };
      }
    );
  };

  const runFull = (): ReturnType<typeof getOrCreateReferralForm> =>
    getOrCreateReferralForm(fullReferral, {
      oystehr: mockOystehr as never,
      secrets: createMockSecrets(),
      token: 'token',
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReferralFormPDF.mockResolvedValue({
      documentReference: {
        resourceType: 'DocumentReference',
        id: 'form-2',
        content: [{ attachment: { url: 'z3://referrals/new.pdf' } }],
      },
      presignedURL: 'https://signed/new.pdf',
    });
  });

  it('reuses the stored form when nothing it prints has changed since', async () => {
    const world = initialWorld();
    serve(world, storedForm(makeOrderFormVersion(REFERRAL_FORM_TEMPLATE_VERSION, sourcesOf(world))));

    const form = await runFull();

    expect(form).toEqual({
      documentReference: expect.objectContaining({ id: 'stored-form' }),
      z3Url: 'z3://referrals/stored.pdf',
    });
    expect(mockCreateReferralFormPDF).not.toHaveBeenCalled();
  });

  it.each([
    ['patient', 'patient'],
    ['practice, whose fax the response sentence points to', 'practice'],
    ['office location', 'location'],
    ['referring practitioner', 'practitioner'],
    ['recipient address-book contact', 'recipient'],
    ['earlier document', 'earlier'],
  ] as [string, keyof World][])('draws the form again when the %s changed since it was stored', async (_label, key) => {
    const world = initialWorld();
    const stored = storedForm(makeOrderFormVersion(REFERRAL_FORM_TEMPLATE_VERSION, sourcesOf(world)));
    serve({ ...world, [key]: versioned(world[key], '2') }, stored);

    const form = await runFull();

    expect(form.z3Url).toBe('z3://referrals/new.pdf');
    expect(mockCreateReferralFormPDF).toHaveBeenCalledTimes(1);
  });

  it('draws again a form stored before the layout was versioned, which was keyed on the ServiceRequest alone', async () => {
    const world = initialWorld();
    serve(world, storedForm(`ServiceRequest/${REFERRAL_ID}@7`));

    await runFull();

    expect(mockCreateReferralFormPDF).toHaveBeenCalledTimes(1);
  });

  it('stamps the new form with the template and every printed source, so the next print can reuse it', async () => {
    const world = initialWorld();
    serve(world, storedForm(undefined));

    await runFull();

    const stamped = mockCreateReferralFormPDF.mock.calls[0][4] as string;
    expect(stamped).toBe(makeOrderFormVersion(REFERRAL_FORM_TEMPLATE_VERSION, sourcesOf(world)));
    expect(stamped).toMatch(new RegExp(`^template@${REFERRAL_FORM_TEMPLATE_VERSION}\\|`));
    for (const source of sourcesOf(world)) expect(stamped).toContain(`${source.resourceType}/${source.id}@`);
  });

  it('prints the recipient from its contact, with the fax chosen on the referral', async () => {
    const world = initialWorld();
    serve(world, storedForm(undefined));

    await runFull();

    expect(mockCreateReferralFormPDF.mock.calls[0][0]).toMatchObject({
      location: world.location,
      recipient: { contactId: 'recipient-1', organizationName: 'Springfield Cardiology', fax: '+12125550000' },
      earlierDocuments: [{ documentReference: world.earlier }],
    });
  });
});

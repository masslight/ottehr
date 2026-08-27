import Oystehr from '@oystehr/sdk';
import { Appointment, Attachment, DocumentReference, List, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { getConsentAndRelatedDocRefsForAppointment } from 'utils/lib/fhir/appointments';
import { FHIR_BASE_URL } from 'utils/lib/fhir/constants';
import { createConsentResource, createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getConsentFormsForLocation } from 'utils/lib/ottehr-config/consent-forms';
import { Secrets } from 'utils/lib/secrets';
import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_CODE,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  SCHOOL_WORK_NOTE_WORK_ID,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { uploadPDF } from 'utils/lib/utils/pdf';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createConsentResources, createDocumentResources } from '../src/ehr/shared/harvest';
import { createPdfBytes } from '../src/shared/pdf';

/**
 * First real coverage for createConsentResources and createDocumentResources — the two
 * largest harvest blocks, previously exercised only as vi.mock stubs in the strategy
 * dispatch tests. The FHIR writers (createFilesDocumentReferences / createConsentResource),
 * PDF generation, and upload are mocked at their module seams; everything these functions
 * actually own — signer extraction, supersede/inactivate patches, per-form PDF fan-out,
 * type-code grouping, attachment dedup against existing DocumentReferences, creation-time
 * sorting, and category-specific reference wiring — runs for real.
 */

vi.mock('utils/lib/fhir/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/helpers')>();
  return { ...original, createFilesDocumentReferences: vi.fn(), createConsentResource: vi.fn() };
});

vi.mock('utils/lib/fhir/appointments', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/appointments')>();
  return { ...original, getConsentAndRelatedDocRefsForAppointment: vi.fn() };
});

vi.mock('utils/lib/utils/pdf', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/utils/pdf')>();
  return { ...original, uploadPDF: vi.fn() };
});

vi.mock('../src/shared/pdf', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/shared/pdf')>();
  return { ...original, createPdfBytes: vi.fn() };
});

const mockCreateFilesDocumentReferences = vi.mocked(createFilesDocumentReferences);
const mockCreateConsentResource = vi.mocked(createConsentResource);
const mockGetConsentAndDocRefs = vi.mocked(getConsentAndRelatedDocRefsForAppointment);
const mockUploadPDF = vi.mocked(uploadPDF);
const mockCreatePdfBytes = vi.mocked(createPdfBytes);

const PATIENT_ID = 'pat-1';
const APPOINTMENT_ID = 'appt-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateFilesDocumentReferences.mockResolvedValue({ docRefs: [], listResources: undefined });
});

describe('createDocumentResources', () => {
  const attachment = (url: string, creation?: string): Attachment => ({
    url,
    title: url.split('/').pop(),
    contentType: 'image/jpeg',
    ...(creation ? { creation } : {}),
  });

  const qrWithAttachments = (entries: { linkId: string; attachment?: Attachment }[]): QuestionnaireResponse => ({
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    item: [
      {
        linkId: 'harvested-page',
        item: entries.map(({ linkId, attachment: valueAttachment }) => ({
          linkId,
          ...(valueAttachment ? { answer: [{ valueAttachment }] } : {}),
        })),
      },
    ],
  });

  const existingDocRefWith = (...urls: string[]): DocumentReference => ({
    resourceType: 'DocumentReference',
    status: 'current',
    content: urls.map((url) => ({ attachment: { url } })),
  });

  const run = (
    qr: QuestionnaireResponse,
    existingDocRefs: DocumentReference[] = [],
    lists: List[] = []
  ): Promise<void> =>
    createDocumentResources(qr, PATIENT_ID, APPOINTMENT_ID, {} as unknown as Oystehr, lists, existingDocRefs);

  test('creates a photo-ID document with files sorted by creation time and patient-scoped references', async () => {
    const front = attachment('z3://bucket/front.jpg', '2026-08-02T10:00:00Z');
    const back = attachment('z3://bucket/back.jpg', '2026-08-01T10:00:00Z');
    await run(
      qrWithAttachments([
        { linkId: PHOTO_ID_FRONT_ID, attachment: front },
        { linkId: PHOTO_ID_BACK_ID, attachment: back },
      ])
    );

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
    const input = mockCreateFilesDocumentReferences.mock.calls[0][0];
    expect(input.type.coding?.[0]).toEqual({
      system: 'http://loinc.org',
      code: PHOTO_ID_CARD_CODE,
      display: 'Patient data Document',
    });
    // back.jpg was created first, so it sorts to the front and supplies dateCreated
    expect(input.files).toEqual([
      { url: 'z3://bucket/back.jpg', title: 'back.jpg' },
      { url: 'z3://bucket/front.jpg', title: 'front.jpg' },
    ]);
    expect(input.dateCreated).toBe('2026-08-01T10:00:00Z');
    expect(input.references).toEqual({
      subject: { reference: `Patient/${PATIENT_ID}` },
      context: { related: [{ reference: `Patient/${PATIENT_ID}` }] },
    });
    expect(input.meta).toEqual({ tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }] });
    expect(input.searchParams).toContainEqual({ name: 'related', value: `Appointment/${APPOINTMENT_ID}` });
  });

  test('deduplicates against existing DocumentReferences by attachment url', async () => {
    const front = attachment('z3://bucket/front.jpg', '2026-08-02T10:00:00Z');
    const back = attachment('z3://bucket/back.jpg', '2026-08-01T10:00:00Z');
    await run(
      qrWithAttachments([
        { linkId: PHOTO_ID_FRONT_ID, attachment: front },
        { linkId: PHOTO_ID_BACK_ID, attachment: back },
      ]),
      [existingDocRefWith('z3://bucket/front.jpg')]
    );

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
    expect(mockCreateFilesDocumentReferences.mock.calls[0][0].files).toEqual([
      { url: 'z3://bucket/back.jpg', title: 'back.jpg' },
    ]);
  });

  test('writes nothing when every attachment already has a DocumentReference', async () => {
    const front = attachment('z3://bucket/front.jpg');
    await run(qrWithAttachments([{ linkId: PHOTO_ID_FRONT_ID, attachment: front }]), [
      existingDocRefWith('z3://bucket/front.jpg'),
    ]);
    expect(mockCreateFilesDocumentReferences).not.toHaveBeenCalled();
  });

  test('ignores attachments with no url', async () => {
    await run(qrWithAttachments([{ linkId: PHOTO_ID_FRONT_ID, attachment: { title: 'no-url.jpg' } }]));
    expect(mockCreateFilesDocumentReferences).not.toHaveBeenCalled();
  });

  test('collects all four insurance card slots into one insurance document', async () => {
    await run(
      qrWithAttachments([
        { linkId: INSURANCE_CARD_FRONT_ID, attachment: attachment('z3://b/primary-front.jpg', '2026-08-01T00:00:00Z') },
        { linkId: INSURANCE_CARD_BACK_ID, attachment: attachment('z3://b/primary-back.jpg', '2026-08-02T00:00:00Z') },
        {
          linkId: INSURANCE_CARD_FRONT_2_ID,
          attachment: attachment('z3://b/secondary-front.jpg', '2026-08-03T00:00:00Z'),
        },
        {
          linkId: INSURANCE_CARD_BACK_2_ID,
          attachment: attachment('z3://b/secondary-back.jpg', '2026-08-04T00:00:00Z'),
        },
      ])
    );

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
    const input = mockCreateFilesDocumentReferences.mock.calls[0][0];
    expect(input.type.coding?.[0].code).toBe(INSURANCE_CARD_CODE);
    expect(input.files).toHaveLength(4);
    expect(input.references?.context).toEqual({ related: [{ reference: `Patient/${PATIENT_ID}` }] });
  });

  test('patient condition photos are appointment-scoped and deduplicated', async () => {
    const photo = attachment('z3://b/condition.jpg', '2026-08-01T00:00:00Z');
    const qr = qrWithAttachments([{ linkId: `${PATIENT_PHOTO_ID_PREFIX}s`, attachment: photo }]);

    await run(qr);
    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
    const input = mockCreateFilesDocumentReferences.mock.calls[0][0];
    expect(input.type.coding?.[0].code).toBe(PATIENT_PHOTO_CODE);
    expect(input.references?.context).toEqual({ related: [{ reference: `Appointment/${APPOINTMENT_ID}` }] });

    mockCreateFilesDocumentReferences.mockClear();
    await run(qr, [existingDocRefWith('z3://b/condition.jpg')]);
    expect(mockCreateFilesDocumentReferences).not.toHaveBeenCalled();
  });

  test('school and work note templates share one appointment-scoped document', async () => {
    await run(
      qrWithAttachments([
        { linkId: SCHOOL_WORK_NOTE_SCHOOL_ID, attachment: attachment('z3://b/school.pdf', '2026-08-01T00:00:00Z') },
        { linkId: SCHOOL_WORK_NOTE_WORK_ID, attachment: attachment('z3://b/work.pdf', '2026-08-02T00:00:00Z') },
      ])
    );

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(1);
    const input = mockCreateFilesDocumentReferences.mock.calls[0][0];
    expect(input.type.coding?.[0].code).toBe(SCHOOL_WORK_NOTE_TEMPLATE_CODE);
    expect(input.files.map((f) => f.url)).toEqual(['z3://b/school.pdf', 'z3://b/work.pdf']);
    expect(input.references?.context).toEqual({ related: [{ reference: `Appointment/${APPOINTMENT_ID}` }] });
  });

  test('threads the List resources returned by one document write into the next', async () => {
    const listFromFirstWrite: List = { resourceType: 'List', status: 'current', mode: 'working', id: 'list-updated' };
    mockCreateFilesDocumentReferences
      .mockResolvedValueOnce({ docRefs: [], listResources: [listFromFirstWrite] })
      .mockResolvedValueOnce({ docRefs: [], listResources: undefined });

    await run(
      qrWithAttachments([
        { linkId: PHOTO_ID_FRONT_ID, attachment: attachment('z3://b/front.jpg', '2026-08-01T00:00:00Z') },
        { linkId: INSURANCE_CARD_FRONT_ID, attachment: attachment('z3://b/ins.jpg', '2026-08-01T00:00:00Z') },
      ]),
      [],
      []
    );

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(2);
    expect(mockCreateFilesDocumentReferences.mock.calls[0][0].listResources).toEqual([]);
    expect(mockCreateFilesDocumentReferences.mock.calls[1][0].listResources).toEqual([listFromFirstWrite]);
  });
});

describe('createConsentResources', () => {
  const [HIPAA_FORM, CTT_FORM] = getConsentFormsForLocation();
  const IL_FORMS = getConsentFormsForLocation('IL');

  const SECRETS = { PROJECT_ID: 'proj-123', PROJECT_API: 'https://project.api' } as unknown as Secrets;

  const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID };

  const makeAppointment = (telemed = false): Appointment => ({
    resourceType: 'Appointment',
    id: APPOINTMENT_ID,
    status: 'booked',
    participant: [{ actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' }],
    ...(telemed ? { meta: { tag: [{ code: OTTEHR_MODULE.TM }] } } : {}),
  });

  const makeLocation = (state = 'CA'): Location => ({
    resourceType: 'Location',
    address: { state },
    identifier: [{ system: `${FHIR_BASE_URL}/r4/facility-name`, value: 'Sunset Clinic' }],
  });

  type SignerFields = Partial<Record<'signature' | 'fullName' | 'relationship', string | undefined>>;

  // Mirrors the consent strategy handler: the QR is scoped to just the consent page.
  // Pass an explicit `undefined` to omit that signer field from the response.
  const consentPageQr = (overrides: SignerFields = {}): QuestionnaireResponse => {
    const values = { signature: 'Jane Doe', fullName: 'Jane Doe', relationship: 'Self', ...overrides };
    const answerItem = (linkId: string, value: string | undefined): object[] =>
      value !== undefined ? [{ linkId, answer: [{ valueString: value }] }] : [];
    return {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [
        {
          linkId: 'consent-forms-page',
          item: [
            ...answerItem('signature', values.signature),
            ...answerItem('full-name', values.fullName),
            ...answerItem('consent-form-signer-relationship', values.relationship),
          ],
        },
      ],
    } as QuestionnaireResponse;
  };

  const makeOystehr = (): { fhir: { patch: ReturnType<typeof vi.fn> } } => ({
    fhir: { patch: vi.fn().mockResolvedValue({}) },
  });

  const run = (
    overrides: {
      qr?: QuestionnaireResponse;
      appointment?: Appointment;
      location?: Location;
      oystehr?: ReturnType<typeof makeOystehr>;
    } = {}
  ): Promise<void> =>
    createConsentResources({
      questionnaireResponse: overrides.qr ?? consentPageQr(),
      patientResource: patient,
      locationResource: overrides.location ?? makeLocation(),
      appointment: overrides.appointment ?? makeAppointment(),
      oystehrAccessToken: 'test-token',
      oystehr: (overrides.oystehr ?? makeOystehr()) as unknown as Oystehr,
      secrets: SECRETS,
      listResources: [],
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T15:00:00Z'));
    mockGetConsentAndDocRefs.mockResolvedValue({ consents: [], docRefs: [] });
    mockCreatePdfBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockUploadPDF.mockResolvedValue(undefined);
    // Return one DocumentReference per file, titled like the file, so the consent-creation
    // step can find its matching docref the same way production data would.
    mockCreateFilesDocumentReferences.mockImplementation(async (input) => ({
      listResources: undefined,
      docRefs: input.files.map((file, index) => ({
        resourceType: 'DocumentReference' as const,
        id: `dr-${input.type.text}-${index}`,
        status: 'current' as const,
        type: input.type,
        content: [{ attachment: { url: file.url, title: file.title } }],
      })),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    ['signature', { signature: undefined }, /Consent signature missing/],
    ['full name', { fullName: undefined }, /Consent signer full name missing/],
    ['relationship', { relationship: undefined }, /Consent signer relationship missing/],
  ])('throws when the consent signer %s is missing', async (_label, fields, expected) => {
    await expect(run({ qr: consentPageQr(fields) })).rejects.toThrow(expected);
    expect(mockCreatePdfBytes).not.toHaveBeenCalled();
  });

  test('creates, uploads, and files one PDF per configured consent form', async () => {
    await run();

    // One PDF per form in the reference config (HIPAA + consent-to-treat)
    expect(mockCreatePdfBytes).toHaveBeenCalledTimes(2);
    const pdfInfos = mockCreatePdfBytes.mock.calls.map((call) => call[3]);
    expect(pdfInfos.map((info) => info.formTitle)).toEqual([HIPAA_FORM.formTitle, CTT_FORM.formTitle]);
    expect(pdfInfos[1].copyFromPath).toBe(CTT_FORM.assetPath);

    // Upload URLs are keyed by project bucket, patient, timestamp, and form id
    const expectedBase = `https://project.api/z3/proj-123-consent-forms/${PATIENT_ID}/${Date.now()}`;
    expect(mockUploadPDF).toHaveBeenCalledTimes(2);
    expect(mockUploadPDF).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      `${expectedBase}-${HIPAA_FORM.id}.pdf`,
      'test-token',
      PATIENT_ID
    );

    // One DocumentReference group per type code, appointment-scoped
    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledTimes(2);
    for (const call of mockCreateFilesDocumentReferences.mock.calls) {
      expect(call[0].references).toEqual({
        subject: { reference: `Patient/${PATIENT_ID}` },
        context: { related: [{ reference: `Appointment/${APPOINTMENT_ID}` }] },
      });
    }

    // Only the consent-to-treat form creates a Consent resource, linked to its docref
    expect(mockCreateConsentResource).toHaveBeenCalledTimes(1);
    const [consentPatientId, consentDocRefId, consentDate] = mockCreateConsentResource.mock.calls[0];
    expect(consentPatientId).toBe(PATIENT_ID);
    expect(consentDocRefId).toBe(`dr-${CTT_FORM.type.text}-0`);
    expect(consentDate).toContain('2026-08-20T15:00:00');
  });

  test('supersedes prior consent DocumentReferences and inactivates prior Consents', async () => {
    mockGetConsentAndDocRefs.mockResolvedValue({
      consents: [{ resourceType: 'Consent', id: 'old-consent' }],
      docRefs: [{ resourceType: 'DocumentReference', id: 'old-docref' }],
    } as never);
    const oystehr = makeOystehr();

    await run({ oystehr });

    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      id: 'old-docref',
      operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
    });
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Consent',
      id: 'old-consent',
      operations: [{ op: 'replace', path: '/status', value: 'inactive' }],
    });
  });

  test('resolves state-specific consent form assets (the Illinois variant)', async () => {
    await run({ location: makeLocation('IL') });
    const cttPdfInfo = mockCreatePdfBytes.mock.calls[1][3];
    expect(cttPdfInfo.copyFromPath).toBe(IL_FORMS[1].assetPath);
    expect(cttPdfInfo.copyFromPath).not.toBe(CTT_FORM.assetPath);
  });

  test('labels telemed visits with the telemedicine facility name', async () => {
    await run({ appointment: makeAppointment(true) });
    // createPdfBytes(patient, signer, date, pdfInfo, secrets, timezone, facilityName)
    expect(mockCreatePdfBytes.mock.calls[0][6]).toBe('Ottehr Telemedicine');

    mockCreatePdfBytes.mockClear();
    await run();
    expect(mockCreatePdfBytes.mock.calls[0][6]).toBe('Sunset Clinic');
  });

  // Pins current behavior: signature-timezone is looked up on the TOP-LEVEL QR items only,
  // but the consent strategy hands this function a page-scoped QR whose top level is the
  // page group — so the timezone always resolves undefined on the harvest path.
  test('signature-timezone is not found through the page-scoped QR shape', async () => {
    const qr = consentPageQr();
    qr.item?.[0].item?.push({ linkId: 'signature-timezone', answer: [{ valueString: 'America/New_York' }] });
    await run({ qr });
    expect(mockCreatePdfBytes.mock.calls[0][5]).toBeUndefined();
  });

  test('wraps upload failures with the form title', async () => {
    mockUploadPDF.mockRejectedValueOnce(new Error('z3 unavailable'));
    await expect(run()).rejects.toThrow(`Failed to upload ${HIPAA_FORM.formTitle} PDF. z3 unavailable`);
  });

  test('throws when no DocumentReference matches the consent form title', async () => {
    mockCreateFilesDocumentReferences.mockImplementation(async (input) => ({
      listResources: undefined,
      docRefs: input.files.map((file, index) => ({
        resourceType: 'DocumentReference' as const,
        id: `dr-${index}`,
        status: 'current' as const,
        content: [{ attachment: { url: file.url, title: 'some other title' } }],
      })),
    }));
    await expect(run()).rejects.toThrow(`DocumentReference for "${CTT_FORM.formTitle}" not found`);
  });
});

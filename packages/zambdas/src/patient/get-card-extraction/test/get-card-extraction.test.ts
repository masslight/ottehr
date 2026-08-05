import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference } from 'fhir/r4b';
import {
  APIErrorCode,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  INSURANCE_CARD_FRONT_ID,
  InsuranceCardExtraction,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PHOTO_ID_FRONT_ID,
  PhotoIdExtraction,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { getCardExtraction } from '../index';

const APPOINTMENT_ID = 'appt-1';
const PATIENT_ID = 'patient-1';

const APPOINTMENT: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'booked',
  participant: [{ actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' }],
};

const INSURANCE_FIELDS: InsuranceCardExtraction['fields'] = {
  payer: 'Aetna',
  memberName: 'JANE DOE',
  memberId: 'W123456789',
  groupNumber: 'GRP-1',
  payerId: '60054',
  rxBin: null,
  rxPcn: null,
  rxGroup: null,
  insuranceType: 'PPO',
  effectiveDate: '2026-01-01',
};

const makeInsuranceExtraction = (overrides: Partial<InsuranceCardExtraction> = {}): InsuranceCardExtraction => ({
  version: 1,
  isInsuranceCard: true,
  readable: true,
  fields: INSURANCE_FIELDS,
  sourceDocRefId: 'doc-ref-1',
  sourceAttachmentUrl: 'https://example.com/z3/card.jpg',
  imageHash: 'abc123',
  model: 'gemini-3.1-flash-lite',
  extractedAt: '2026-07-09T12:00:00.000Z',
  ...overrides,
});

const makeDocRef = ({
  id = 'doc-ref-1',
  title = INSURANCE_CARD_FRONT_ID,
  extension,
}: {
  id?: string;
  title?: string;
  extension?: { url: string; valueString: string }[];
} = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  content: [{ attachment: { url: `https://example.com/z3/${id}.jpg`, title } }],
  subject: { reference: `Patient/${PATIENT_ID}` },
  context: { related: [{ reference: `Patient/${PATIENT_ID}` }, { reference: `Appointment/${APPOINTMENT_ID}` }] },
  ...(extension ? { extension } : {}),
});

interface MockOystehr {
  oystehr: Oystehr;
  fhir: {
    get: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
}

const makeMockOystehr = ({
  appointment = APPOINTMENT,
  docRefs = [],
}: {
  appointment?: Appointment | null;
  docRefs?: DocumentReference[];
} = {}): MockOystehr => {
  const fhir = {
    get: vi.fn(async () => {
      // getAppointmentResourceById maps a FHIR not-found issue to undefined
      if (!appointment) throw { issue: [{ code: 'not-found' }] };
      return appointment;
    }),
    search: vi.fn(async () => ({ unbundle: () => docRefs })),
  };
  return { oystehr: { fhir } as unknown as Oystehr, fhir };
};

describe('get-card-extraction', () => {
  it('returns ready with the parsed fields when the DocRef carries a stored insurance extraction', async () => {
    const extraction = makeInsuranceExtraction();
    const { oystehr, fhir } = makeMockOystehr({
      docRefs: [
        makeDocRef({
          extension: [{ url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(extraction) }],
        }),
      ],
    });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    expect(result).toEqual({
      status: 'ready',
      fields: INSURANCE_FIELDS,
      model: extraction.model,
      extractedAt: extraction.extractedAt,
    });
    // the DocRef search must be scoped to the appointment's own patient + the appointment itself
    expect(fhir.search).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'subject', value: `Patient/${PATIENT_ID}` },
        { name: 'related', value: `Appointment/${APPOINTMENT_ID}` },
        { name: '_sort', value: '-_lastUpdated' },
      ],
    });
  });

  it('reads the photo ID extraction extension for the photo-id-front slot', async () => {
    const photoIdExtraction: PhotoIdExtraction = {
      version: 1,
      isPhotoId: true,
      fields: {
        firstName: 'Jane',
        middleName: null,
        lastName: 'Doe',
        suffix: null,
        dateOfBirth: '1990-05-05',
        sex: 'Female',
        addressLine1: '1 Main St',
        addressCity: 'Boston',
        addressState: 'MA',
        addressZip: '02110',
        licenseNumber: 'S123',
        expirationDate: '2030-01-01',
      },
      sourceDocRefId: 'doc-ref-1',
      sourceAttachmentUrl: 'https://example.com/z3/id.jpg',
      imageHash: 'def456',
      model: 'gemini-3.1-flash-lite',
      extractedAt: '2026-07-09T12:00:00.000Z',
    };
    const { oystehr } = makeMockOystehr({
      docRefs: [
        makeDocRef({
          title: PHOTO_ID_FRONT_ID,
          extension: [{ url: PHOTO_ID_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(photoIdExtraction) }],
        }),
      ],
    });

    const result = await getCardExtraction({ appointmentID: APPOINTMENT_ID, cardType: PHOTO_ID_FRONT_ID, oystehr });

    expect(result.status).toBe('ready');
    expect(result.fields).toEqual(photoIdExtraction.fields);
  });

  it('returns pending when the DocRef exists but the extraction extension has not landed yet', async () => {
    const { oystehr } = makeMockOystehr({ docRefs: [makeDocRef()] });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    expect(result).toEqual({ status: 'pending' });
  });

  it('returns pending when no DocRef exists for the card slot yet', async () => {
    const { oystehr } = makeMockOystehr({ docRefs: [] });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    expect(result).toEqual({ status: 'pending' });
  });

  it('returns not-a-card for a stored notACard verdict', async () => {
    const extraction = makeInsuranceExtraction({
      isInsuranceCard: false,
      readable: null,
      fields: null,
      notACard: true,
    });
    const { oystehr } = makeMockOystehr({
      docRefs: [
        makeDocRef({
          extension: [{ url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(extraction) }],
        }),
      ],
    });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    expect(result).toEqual({ status: 'not-a-card' });
  });

  it('returns unreadable when OCR stored fields but every field is null', async () => {
    const allNullFields = Object.fromEntries(
      Object.keys(INSURANCE_FIELDS).map((key) => [key, null])
    ) as unknown as InsuranceCardExtraction['fields'];
    const extraction = makeInsuranceExtraction({ fields: allNullFields });
    const { oystehr } = makeMockOystehr({
      docRefs: [
        makeDocRef({
          extension: [{ url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(extraction) }],
        }),
      ],
    });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    expect(result).toEqual({ status: 'unreadable' });
  });

  it('uses the NEWEST DocRef for the slot (search is newest-first)', async () => {
    const newest = makeDocRef({ id: 'doc-ref-new' }); // no extension yet — a fresh re-upload
    const older = makeDocRef({
      id: 'doc-ref-old',
      extension: [
        { url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(makeInsuranceExtraction()) },
      ],
    });
    const { oystehr } = makeMockOystehr({ docRefs: [newest, older] });

    const result = await getCardExtraction({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      oystehr,
    });

    // an older card's extraction must never answer for the newer upload still being OCR'd
    expect(result).toEqual({ status: 'pending' });
  });

  it('rejects an unknown / foreign appointment with the structured appointment-not-found error', async () => {
    const { oystehr, fhir } = makeMockOystehr({ appointment: null });

    await expect(
      getCardExtraction({ appointmentID: 'not-my-appointment', cardType: INSURANCE_CARD_FRONT_ID, oystehr })
    ).rejects.toMatchObject({ code: APIErrorCode.APPOINTMENT_NOT_FOUND });

    expect(fhir.search).not.toHaveBeenCalled();
  });
});

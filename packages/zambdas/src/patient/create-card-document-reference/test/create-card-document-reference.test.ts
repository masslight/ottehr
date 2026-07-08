import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, List, QuestionnaireResponse } from 'fhir/r4b';
import {
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_FRONT_ID,
  LOINC_SYSTEM,
  OTTEHR_MODULE,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_FRONT_ID,
  Secrets,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { createDocumentResources } from '../../../ehr/shared/harvest';
import { createCardDocumentReference } from '../index';

const PROJECT_API = 'https://project-api.example.com/v1';
const PROJECT_ID = 'project-1';
const APPOINTMENT_ID = 'appt-1';
const PATIENT_ID = 'patient-1';

const SECRETS = { PROJECT_API, PROJECT_ID } as unknown as Secrets;

const INSURANCE_FRONT_Z3_URL = `${PROJECT_API}/z3/${PROJECT_ID}-insurance-cards/${PATIENT_ID}/2026-07-08-1751970000000-${INSURANCE_CARD_FRONT_ID}.jpg`;
const PHOTO_ID_FRONT_Z3_URL = `${PROJECT_API}/z3/${PROJECT_ID}-photo-id-cards/${PATIENT_ID}/2026-07-08-1751970000000-${PHOTO_ID_FRONT_ID}.png`;

const APPOINTMENT: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'booked',
  participant: [{ actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' }],
};

interface MockOystehr {
  oystehr: Oystehr;
  fhir: {
    get: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  createdDocRefs: DocumentReference[];
}

const makeMockOystehr = ({
  existingDocRefs = [],
  lists = [],
}: {
  existingDocRefs?: DocumentReference[];
  lists?: List[];
} = {}): MockOystehr => {
  const createdDocRefs: DocumentReference[] = [];
  const fhir = {
    get: vi.fn(async () => APPOINTMENT),
    search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'DocumentReference' ? existingDocRefs : lists),
    })),
    transaction: vi.fn(async ({ requests }: { requests: { resource: DocumentReference }[] }) => {
      const resource = { ...requests[0].resource, id: `doc-ref-${createdDocRefs.length + 1}` };
      createdDocRefs.push(resource);
      return { entry: [{ resource }] };
    }),
    patch: vi.fn(async ({ resourceType, id }: { resourceType: string; id: string }) => ({ resourceType, id })),
    create: vi.fn(async (resource: List) => ({ ...resource, id: 'list-1' })),
  };
  return { oystehr: { fhir } as unknown as Oystehr, fhir, createdDocRefs };
};

describe('create-card-document-reference', () => {
  it('creates exactly one DocumentReference with the harvest-compatible shape for an insurance card upload', async () => {
    const { oystehr, fhir, createdDocRefs } = makeMockOystehr();

    const result = await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr,
    });

    expect(fhir.transaction).toHaveBeenCalledTimes(1);
    expect(createdDocRefs).toHaveLength(1);
    expect(result.documentReferenceID).toBe(createdDocRefs[0].id);

    const docRef = createdDocRefs[0];
    expect(docRef.status).toBe('current');
    expect(docRef.type?.coding?.[0]).toEqual({
      system: LOINC_SYSTEM,
      code: INSURANCE_CARD_CODE,
      display: 'Health insurance card',
    });
    expect(docRef.content[0].attachment).toEqual({
      url: INSURANCE_FRONT_Z3_URL,
      // title must be the paperwork linkId: it is both the harvest reuse key in
      // createFilesDocumentReferences and the card-slot allowlist key in the OCR subscriptions
      title: INSURANCE_CARD_FRONT_ID,
      contentType: 'image/jpeg',
    });
    expect(docRef.subject).toEqual({ reference: `Patient/${PATIENT_ID}` });
    // Patient related ref: visibility for get-visit-files (related=Patient/{id});
    // Appointment related ref: in scope of harvest's subject+related dedupe search
    expect(docRef.context?.related).toEqual([
      { reference: `Patient/${PATIENT_ID}` },
      { reference: `Appointment/${APPOINTMENT_ID}` },
    ]);
    expect(docRef.meta?.tag).toEqual([{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }]);
  });

  it('uses the photo ID type coding for photo ID uploads', async () => {
    const { oystehr, createdDocRefs } = makeMockOystehr();

    await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: PHOTO_ID_FRONT_ID,
      z3URL: PHOTO_ID_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr,
    });

    expect(createdDocRefs).toHaveLength(1);
    expect(createdDocRefs[0].type?.coding?.[0]).toEqual({
      system: LOINC_SYSTEM,
      code: PHOTO_ID_CARD_CODE,
      display: 'Patient data Document',
    });
    expect(createdDocRefs[0].content[0].attachment?.contentType).toBe('image/png');
  });

  it('reuses the existing DocumentReference on a repeat call for the same url (no duplicate)', async () => {
    const first = makeMockOystehr();
    await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr: first.oystehr,
    });

    // second call: the dedupe search now returns the doc created by the first call
    const second = makeMockOystehr({ existingDocRefs: first.createdDocRefs });
    const result = await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr: second.oystehr,
    });

    expect(second.fhir.transaction).not.toHaveBeenCalled();
    expect(second.fhir.patch).not.toHaveBeenCalled();
    expect(result.documentReferenceID).toBe(first.createdDocRefs[0].id);
  });

  it('is skipped entirely by the paperwork harvest for an already-registered attachment url', async () => {
    // create the upload-time doc
    const upload = makeMockOystehr();
    await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr: upload.oystehr,
    });

    // simulate harvest at page save: its subject+related search returns the upload-time doc,
    // so the attachment url is filtered out before any DocumentReference write
    const questionnaireResponse: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [
        {
          linkId: 'payment-option-page',
          item: [
            {
              linkId: INSURANCE_CARD_FRONT_ID,
              answer: [
                {
                  valueAttachment: {
                    url: INSURANCE_FRONT_Z3_URL,
                    title: INSURANCE_CARD_FRONT_ID,
                    creation: '2026-07-08T12:00:00.000Z',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const harvest = makeMockOystehr();
    await createDocumentResources(
      questionnaireResponse,
      PATIENT_ID,
      APPOINTMENT_ID,
      harvest.oystehr,
      [],
      upload.createdDocRefs
    );

    expect(harvest.fhir.transaction).not.toHaveBeenCalled();
    expect(harvest.fhir.patch).not.toHaveBeenCalled();
  });

  it('rejects a z3 url outside the patient card bucket folder', async () => {
    const { oystehr, fhir } = makeMockOystehr();

    await expect(
      createCardDocumentReference({
        appointmentID: APPOINTMENT_ID,
        cardType: INSURANCE_CARD_FRONT_ID,
        z3URL: `${PROJECT_API}/z3/${PROJECT_ID}-insurance-cards/other-patient/2026-07-08-1751970000000-${INSURANCE_CARD_FRONT_ID}.jpg`,
        secrets: SECRETS,
        oystehr,
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('z3URL') });

    expect(fhir.transaction).not.toHaveBeenCalled();
  });
});

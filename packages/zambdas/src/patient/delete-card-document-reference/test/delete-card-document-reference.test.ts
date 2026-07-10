import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, List } from 'fhir/r4b';
import { INSURANCE_CARD_CODE, INSURANCE_CARD_FRONT_ID, Secrets } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { createCardDocumentReference } from '../../create-card-document-reference';
import { deleteCardDocumentReference } from '../index';

const PROJECT_API = 'https://project-api.example.com/v1';
const PROJECT_ID = 'project-1';
const APPOINTMENT_ID = 'appt-1';
const PATIENT_ID = 'patient-1';

const SECRETS = { PROJECT_API, PROJECT_ID } as unknown as Secrets;

const INSURANCE_FRONT_Z3_URL = `${PROJECT_API}/z3/${PROJECT_ID}-insurance-cards/${PATIENT_ID}/2026-07-08-1751970000000-${INSURANCE_CARD_FRONT_ID}.jpg`;

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
    delete: ReturnType<typeof vi.fn>;
  };
  createdDocRefs: DocumentReference[];
  deletedDocRefIds: string[];
}

const makeMockOystehr = ({
  existingDocRefs = [],
  lists = [],
}: {
  existingDocRefs?: DocumentReference[];
  lists?: List[];
} = {}): MockOystehr => {
  const createdDocRefs: DocumentReference[] = [];
  const deletedDocRefIds: string[] = [];
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
    delete: vi.fn(async ({ id }: { resourceType: string; id: string }) => {
      deletedDocRefIds.push(id);
    }),
  };
  return { oystehr: { fhir } as unknown as Oystehr, fhir, createdDocRefs, deletedDocRefIds };
};

describe('delete-card-document-reference', () => {
  it('deletes the upload-time DocumentReference (and its folder List entry) after upload then clear', async () => {
    // upload: create-card-document-reference makes the upload-time doc
    const upload = makeMockOystehr();
    await createCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr: upload.oystehr,
    });
    expect(upload.createdDocRefs).toHaveLength(1);
    const uploadedDocRef = upload.createdDocRefs[0];

    // clear: the delete zambda finds the doc by subject + related + attachment url and deletes it
    const folderList: List = {
      resourceType: 'List',
      id: 'list-1',
      status: 'current',
      mode: 'working',
      code: { coding: [{ code: INSURANCE_CARD_CODE }] },
      subject: { reference: `Patient/${PATIENT_ID}` },
      entry: [{ item: { type: 'DocumentReference', reference: `DocumentReference/${uploadedDocRef.id}` } }],
    };
    const clear = makeMockOystehr({ existingDocRefs: upload.createdDocRefs, lists: [folderList] });

    const result = await deleteCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr: clear.oystehr,
    });

    expect(result).toEqual({ deleted: true });
    expect(clear.deletedDocRefIds).toEqual([uploadedDocRef.id]);
    // the folder List entry pointing at the deleted doc is removed
    expect(clear.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'List',
      id: 'list-1',
      operations: [{ op: 'replace', path: '/entry', value: [] }],
    });
  });

  it('only deletes the doc whose attachment url matches the cleared image', async () => {
    const otherDocRef: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'doc-ref-other',
      status: 'current',
      content: [
        {
          attachment: {
            url: `${PROJECT_API}/z3/${PROJECT_ID}-insurance-cards/${PATIENT_ID}/2026-07-08-1751970000001-${INSURANCE_CARD_FRONT_ID}.jpg`,
            title: INSURANCE_CARD_FRONT_ID,
          },
        },
      ],
    };
    const matchingDocRef: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'doc-ref-match',
      status: 'current',
      content: [{ attachment: { url: INSURANCE_FRONT_Z3_URL, title: INSURANCE_CARD_FRONT_ID } }],
    };
    const { oystehr, deletedDocRefIds } = makeMockOystehr({ existingDocRefs: [otherDocRef, matchingDocRef] });

    const result = await deleteCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr,
    });

    expect(result).toEqual({ deleted: true });
    expect(deletedDocRefIds).toEqual(['doc-ref-match']);
  });

  it('is a clean no-op when no matching DocumentReference exists (repeat delete / never created)', async () => {
    const { oystehr, fhir } = makeMockOystehr();

    const result = await deleteCardDocumentReference({
      appointmentID: APPOINTMENT_ID,
      cardType: INSURANCE_CARD_FRONT_ID,
      z3URL: INSURANCE_FRONT_Z3_URL,
      secrets: SECRETS,
      oystehr,
    });

    expect(result).toEqual({ deleted: false });
    expect(fhir.delete).not.toHaveBeenCalled();
    expect(fhir.patch).not.toHaveBeenCalled();
  });

  it('rejects a z3 url inside another patient folder without deleting anything', async () => {
    const foreignUrl = `${PROJECT_API}/z3/${PROJECT_ID}-insurance-cards/other-patient/2026-07-08-1751970000000-${INSURANCE_CARD_FRONT_ID}.jpg`;
    const foreignDocRef: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'doc-ref-foreign',
      status: 'current',
      content: [{ attachment: { url: foreignUrl, title: INSURANCE_CARD_FRONT_ID } }],
    };
    const { oystehr, fhir } = makeMockOystehr({ existingDocRefs: [foreignDocRef] });

    await expect(
      deleteCardDocumentReference({
        appointmentID: APPOINTMENT_ID,
        cardType: INSURANCE_CARD_FRONT_ID,
        z3URL: foreignUrl,
        secrets: SECRETS,
        oystehr,
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('z3URL') });

    expect(fhir.delete).not.toHaveBeenCalled();
  });
});

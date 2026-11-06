import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, FhirResource, List } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { CUSTOM_FOLDER_KIND_SYSTEM, PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import {
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_RESULT_DOC_REF_CODING_CODE,
  OYSTEHR_LAB_GENERATED_RESULT_CATEGORY_CODING,
} from 'utils/lib/types/data/labs/labs.constants';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import {
  findReferralDocuments,
  loadReferralDocuments,
  REFERRAL_DOCUMENT_REJECTED_MESSAGE,
} from '../../src/shared/referrals/referral-documents';

const PATIENT_ID = 'patient-1';

const doc = (id: string, over: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  date: '2026-09-23T00:00:00.000Z',
  subject: { reference: `Patient/${PATIENT_ID}` },
  content: [{ attachment: { url: `https://z3.example/${id}.pdf`, title: `${id}.pdf` } }],
  ...over,
});

const folder = (title: string, documentIds: string[], over: Partial<List> = {}): List => ({
  resourceType: 'List',
  id: `list-${title}`,
  status: 'current',
  mode: 'working',
  title,
  subject: { reference: `Patient/${PATIENT_ID}` },
  code: { coding: [{ code: PATIENT_FOLDERS_CODE }] },
  entry: documentIds.map((id) => ({ item: { reference: `DocumentReference/${id}` } })),
  ...over,
});

/** A FHIR server stand-in that applies `_id` and `subject` the way the real search does. */
const fakeOystehr = (resources: FhirResource[]): Oystehr =>
  ({
    fhir: {
      search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        const ids = params.find((param) => param.name === '_id')?.value.split(',');
        const subject = params.find((param) => param.name === 'subject')?.value;
        const matches = resources.filter(
          (resource) =>
            resource.resourceType === resourceType &&
            (!ids || ids.includes(resource.id!)) &&
            (!subject || (resource as { subject?: { reference?: string } }).subject?.reference === subject)
        );
        return { unbundle: () => matches };
      },
    },
  }) as unknown as Oystehr;

const visitNote = doc('visit-note', { context: { encounter: [{ reference: 'Encounter/encounter-1' }] } });
const labResult = doc('lab-result', { type: { coding: [{ ...LAB_RESULT_DOC_REF_CODING_CODE }] } });
const labGeneratedResult = doc('lab-generated', {
  category: [{ coding: [{ ...OYSTEHR_LAB_GENERATED_RESULT_CATEGORY_CODING }] }],
});
const labOrderForm = doc('lab-order', { type: { coding: [{ ...LAB_ORDER_DOC_REF_CODING_CODE }] } });
const consentForm = doc('consent');
const faxPacket = doc('fax-packet', { type: { coding: [{ code: FAX_PACKET_CODE }] } });
const recordExport = doc('record-export', { type: { coding: [{ code: MEDICAL_RECORD_EXPORT_CODE }] } });
const supersededNote = doc('superseded-note', { status: 'superseded' });
const otherPatientsNote = doc('other-patient-note', { subject: { reference: 'Patient/patient-2' } });
const customFolderDoc = doc('custom-doc');

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'encounter-1',
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appointment-1' }],
  period: { start: '2026-09-22T18:00:00.000Z' },
};
const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'fulfilled',
  start: '2026-09-22T14:15:00.000Z',
  participant: [],
};

const oystehr = fakeOystehr([
  visitNote,
  labResult,
  labGeneratedResult,
  labOrderForm,
  consentForm,
  faxPacket,
  recordExport,
  supersededNote,
  otherPatientsNote,
  customFolderDoc,
  folder(BUCKET_NAMES.VISIT_NOTES, ['visit-note', 'superseded-note', 'other-patient-note', 'fax-packet']),
  folder(BUCKET_NAMES.LABS, ['lab-result', 'lab-generated', 'lab-order', 'record-export']),
  folder(BUCKET_NAMES.CONSENT_FORMS, ['consent']),
  // A custom folder that happens to carry a system folder's name is still not one referrals send from.
  folder(BUCKET_NAMES.VISIT_NOTES, ['custom-doc'], {
    id: 'custom-list',
    code: { coding: [{ code: PATIENT_FOLDERS_CODE }, { system: CUSTOM_FOLDER_KIND_SYSTEM, code: 'custom' }] },
  }),
  encounter,
  appointment,
]);

const rejected = expect.objectContaining({
  code: APIErrorCode.INVALID_INPUT,
  message: REFERRAL_DOCUMENT_REJECTED_MESSAGE,
});

describe('referral documents', () => {
  it('accepts visit notes and lab results, in the order given, with the visit they belong to', async () => {
    const documents = await loadReferralDocuments(oystehr, PATIENT_ID, ['lab-result', 'visit-note', 'lab-generated']);

    expect(documents.map(({ documentReference }) => documentReference.id)).toEqual([
      'lab-result',
      'visit-note',
      'lab-generated',
    ]);
    // The encounter's appointment start, as the Docs table's Visit column shows it.
    expect(documents[1].visitDate).toBe('2026-09-22T14:15:00.000Z');
    expect(documents[0].visitDate).toBeUndefined();
  });

  it.each([
    ['another patient', 'other-patient-note'],
    ['an unknown id', 'no-such-document'],
    ['a fax packet', 'fax-packet'],
    ['a medical record export', 'record-export'],
    ['a folder referrals do not send from', 'consent'],
    ['a Labs document that is not a result', 'lab-order'],
    ['a superseded version', 'superseded-note'],
    ['a custom folder', 'custom-doc'],
  ])('SECURITY: refuses %s with the one generic message', async (_case, id) => {
    await expect(loadReferralDocuments(oystehr, PATIENT_ID, ['visit-note', id])).rejects.toEqual(rejected);
  });

  it('leaves out, rather than fails on, documents that no longer qualify when listing', async () => {
    const found = await findReferralDocuments(oystehr, PATIENT_ID, ['visit-note', 'lab-order', 'other-patient-note']);

    expect([...found.keys()]).toEqual(['visit-note']);
  });
});

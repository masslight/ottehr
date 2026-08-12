import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, Location, Patient } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  MEDICAL_RECORD_EXPORT_CODE,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { describe, expect, it, vi } from 'vitest';
import { resolveFaxTransmissions } from '../../src/shared/fax/fax-targets';

const PATIENT_ID = 'patient-1';

const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Oliver'], family: 'Black' }],
};

const makeDocument = (id: string, overrides: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  date: `2026-05-0${id.slice(-1)}T00:00:00.000Z`,
  subject: { reference: `Patient/${PATIENT_ID}` },
  content: [{ attachment: { url: `https://z3.example/${id}.pdf` } }],
  ...overrides,
});

const makeOystehr = (resources: { get?: Record<string, unknown>; search?: unknown[] }): Oystehr =>
  ({
    fhir: {
      get: vi.fn(({ resourceType }: { resourceType: string }) => Promise.resolve(resources.get?.[resourceType])),
      search: vi.fn(() => Promise.resolve({ unbundle: () => resources.search ?? [], link: [] } as unknown as never)),
    },
  }) as unknown as Oystehr;

const APPOINTMENT_ID = 'appointment-1';

const makeVisitResources = (
  overrides: { patientId?: string; documents?: DocumentReference[]; appointmentId?: string } = {}
): unknown[] => {
  const appointmentId = overrides.appointmentId ?? APPOINTMENT_ID;
  const visitPatient: Patient = { ...patient, id: overrides.patientId ?? PATIENT_ID };
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: appointmentId,
    status: 'fulfilled',
    participant: [],
    start: '2026-05-05T13:30:00.000Z',
    serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care', display: 'Urgent Care' }] }],
  };
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: `Appointment/${appointmentId}` }],
  };
  const location: Location = {
    resourceType: 'Location',
    id: 'location-1',
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' }],
  };
  return [encounter, appointment, visitPatient, location, ...(overrides.documents ?? [])];
};

const visitNote = (id: string): DocumentReference =>
  makeDocument(id, { type: { coding: [{ code: VISIT_NOTE_SUMMARY_CODE }] } });

describe('resolveFaxTransmissions', () => {
  it('faxes only the visit note, newest first, for a visit-note target', async () => {
    const oystehr = makeOystehr({
      search: makeVisitResources({ documents: [visitNote('doc-1'), makeDocument('doc-2'), visitNote('doc-3')] }),
    });

    const [transmission] = await resolveFaxTransmissions(
      { type: 'visit-note', appointmentId: APPOINTMENT_ID },
      oystehr
    );

    expect(transmission.cover.title).toBe('Urgent Care Visit of Black, Oliver');
    expect(transmission.cover.identifiers).toContain(`VID: ${APPOINTMENT_ID}`);
    expect(transmission.cover.identifiers).toContain('DOS: 05/05/2026');
    expect(transmission.documentReferenceId).toBe('doc-3');
    expect(transmission.attachments.map((attachment) => attachment.url)).toEqual(['https://z3.example/doc-3.pdf']);
    expect(transmission.timezone).toBe('America/New_York');
  });

  it('faxes the visit chart in chronological order for a visit-documents target', async () => {
    const superseded = makeDocument('doc-4', { status: 'superseded' });
    const oystehr = makeOystehr({
      search: makeVisitResources({ documents: [makeDocument('doc-2'), visitNote('doc-1'), superseded] }),
    });

    const [transmission] = await resolveFaxTransmissions(
      { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID] },
      oystehr
    );

    expect(transmission.documentReferenceId).toBeUndefined();
    expect(transmission.attachments.map((attachment) => attachment.url)).toEqual([
      'https://z3.example/doc-1.pdf',
      'https://z3.example/doc-2.pdf',
    ]);
  });

  it('fans a multi-visit selection out into one transmission per visit', async () => {
    // Each visit is looked up on its own, so the stub answers per requested appointment.
    const oystehr = {
      fhir: {
        search: vi.fn(({ params }: { params: { name: string; value: string }[] }) => {
          const appointmentId = params.find((param) => param.name === 'appointment')!.value.replace('Appointment/', '');
          return Promise.resolve({
            unbundle: () => makeVisitResources({ appointmentId, documents: [makeDocument('doc-1')] }),
          } as unknown as never);
        }),
      },
    } as unknown as Oystehr;

    const transmissions = await resolveFaxTransmissions(
      { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID, 'appointment-2'] },
      oystehr
    );

    expect(transmissions).toHaveLength(2);
    expect(transmissions.every((transmission) => transmission.attachments.length === 1)).toBe(true);
  });

  it('refuses to fax a visit that belongs to another patient', async () => {
    const oystehr = makeOystehr({
      search: makeVisitResources({ patientId: 'someone-else', documents: [makeDocument('doc-1')] }),
    });

    await expect(
      resolveFaxTransmissions(
        { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID] },
        oystehr
      )
    ).rejects.toMatchObject({ message: expect.stringContaining('does not belong to this patient') });
  });

  it('faxes the whole record and leaves previously generated archives out of it', async () => {
    const archive = makeDocument('doc-3', {
      type: { coding: [{ code: MEDICAL_RECORD_EXPORT_CODE }] },
      content: [{ attachment: { url: 'https://z3.example/export.zip' } }],
    });
    const oystehr = makeOystehr({
      get: { Patient: patient },
      search: [makeDocument('doc-2'), makeDocument('doc-1'), archive],
    });

    const [transmission] = await resolveFaxTransmissions({ type: 'medical-record', patientId: PATIENT_ID }, oystehr);

    expect(transmission.cover.title).toBe('Medical Record of Black, Oliver');
    // Oldest first, and the archive of the record is not part of the record.
    expect(transmission.attachments.map((attachment) => attachment.url)).toEqual([
      'https://z3.example/doc-1.pdf',
      'https://z3.example/doc-2.pdf',
    ]);
    expect(transmission.appointmentId).toBeUndefined();
  });

  it('faxes a single document under the patient it belongs to', async () => {
    const document = makeDocument('doc-1');
    const oystehr = makeOystehr({ get: { Patient: patient, DocumentReference: document } });

    const [transmission] = await resolveFaxTransmissions(
      { type: 'document', patientId: PATIENT_ID, documentReferenceId: 'doc-1' },
      oystehr
    );

    expect(transmission.documentReferenceId).toBe('doc-1');
    expect(transmission.cover.title).toBe('Black, Oliver');
    expect(transmission.attachments).toHaveLength(1);
  });

  it('refuses to fax a document that belongs to another patient', async () => {
    const otherPatientsDocument = makeDocument('doc-1', { subject: { reference: 'Patient/someone-else' } });
    const oystehr = makeOystehr({ get: { Patient: patient, DocumentReference: otherPatientsDocument } });

    await expect(
      resolveFaxTransmissions({ type: 'document', patientId: PATIENT_ID, documentReferenceId: 'doc-1' }, oystehr)
    ).rejects.toMatchObject({ message: expect.stringContaining('does not belong to this patient') });
  });
});

import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { describe, expect, it, vi } from 'vitest';
import { collectPatientRecordAttachments, getPatientRecordDocuments } from '../../src/shared/patient-documents';

const documentReference = (id: string, url: string, code?: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  date: '2026-05-05T13:30:00.000Z',
  subject: { reference: 'Patient/patient-1' },
  type: code ? { coding: [{ code }] } : undefined,
  content: [{ attachment: { url, title: `${id}.pdf`, contentType: 'application/pdf' } }],
});

describe('collectPatientRecordAttachments', () => {
  it('keeps generated exports and sent packets out of a downloaded medical-record archive', () => {
    const attachments = collectPatientRecordAttachments([
      documentReference('clinical-document', 'https://z3.example/clinical-document.pdf'),
      documentReference('old-archive', 'https://z3.example/old-archive.zip', MEDICAL_RECORD_EXPORT_CODE),
      documentReference('sent-fax', 'https://z3.example/sent-fax.pdf', FAX_PACKET_CODE),
    ]);

    expect(attachments).toEqual([
      {
        url: 'https://z3.example/clinical-document.pdf',
        title: 'clinical-document.pdf',
        contentType: 'application/pdf',
        date: '2026-05-05T13:30:00.000Z',
      },
    ]);
  });
});

describe('getPatientRecordDocuments', () => {
  const MARCH = { from: '2026-03-01T00:00:00.000-05:00', to: '2026-03-31T23:59:59.999-04:00' };

  const dated = (id: string, date: string | undefined, context?: DocumentReference['context']): DocumentReference => ({
    ...documentReference(id, `https://z3.example/${id}.pdf`),
    date,
    ...(context && { context }),
  });

  const oystehrWith = (byType: Record<string, unknown[]>): Oystehr =>
    ({
      fhir: {
        search: vi.fn(({ resourceType }: { resourceType: string }) =>
          Promise.resolve({ unbundle: () => byType[resourceType] ?? [] })
        ),
      },
    }) as unknown as Oystehr;

  it('dates visit documents by their visit and everything else by when it was created', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('paperwork-before-visit', '2026-02-25T09:00:00.000Z', {
          related: [{ reference: 'Appointment/appointment-march' }],
        }),
        dated('note-after-visit', '2026-04-02T09:00:00.000Z', {
          encounter: [{ reference: 'Encounter/encounter-march' }],
        }),
        dated('march-upload', '2026-03-15T12:00:00.000Z', { related: [{ reference: 'Patient/patient-1' }] }),
        dated('april-upload', '2026-04-15T12:00:00.000Z'),
        dated('undated', undefined),
      ],
      Appointment: [{ resourceType: 'Appointment', id: 'appointment-march', start: '2026-03-10T14:00:00.000Z' }],
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'encounter-march',
          appointment: [{ reference: 'Appointment/appointment-march' }],
        },
      ],
    });

    const documents = await getPatientRecordDocuments(oystehr, 'patient-1', MARCH);

    expect(documents.map((document) => document.id)).toEqual([
      'paperwork-before-visit',
      'note-after-visit',
      'march-upload',
    ]);
  });

  it('keeps what falls exactly on either bound and drops the next millisecond past it', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('just-before-from', '2026-03-01T04:59:59.999Z'),
        dated('on-from', '2026-03-01T05:00:00.000Z'),
        dated('on-to', '2026-04-01T03:59:59.999Z'),
        dated('just-after-to', '2026-04-01T04:00:00.000Z'),
        dated('paperwork-for-visit-on-from', '2026-02-27T12:00:00.000Z', {
          related: [{ reference: 'Appointment/visit-on-from' }],
        }),
        dated('paperwork-for-visit-just-after-to', '2026-03-31T12:00:00.000Z', {
          related: [{ reference: 'Appointment/visit-just-after-to' }],
        }),
      ],
      Appointment: [
        { resourceType: 'Appointment', id: 'visit-on-from', start: '2026-03-01T05:00:00.000Z' },
        { resourceType: 'Appointment', id: 'visit-just-after-to', start: '2026-04-01T04:00:00.000Z' },
      ],
    });

    const documents = await getPatientRecordDocuments(oystehr, 'patient-1', MARCH);

    expect(documents.map((document) => document.id)).toEqual(['on-from', 'on-to', 'paperwork-for-visit-on-from']);
  });
});

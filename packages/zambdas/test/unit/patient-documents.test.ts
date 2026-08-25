import { DocumentReference } from 'fhir/r4b';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { describe, expect, it } from 'vitest';
import { collectPatientRecordAttachments } from '../../src/shared/patient-documents';

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

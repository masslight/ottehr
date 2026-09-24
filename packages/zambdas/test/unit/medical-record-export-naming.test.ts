import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  deriveFileName,
  makeArchiveFileName,
  nameAttachments,
  resolveFileName,
  sanitizeArchiveEntryName,
} from '../../src/shared/medical-record-export/naming';
import { PatientRecordAttachment } from '../../src/shared/patient-documents';

describe('medical record archive entry names', () => {
  describe('deriveFileName', () => {
    it('keeps the document title and appends the extension implied by the content type', () => {
      expect(deriveFileName('https://z3/x/abc', 'Discharge Summary', 'application/pdf')).toBe('Discharge Summary.pdf');
    });

    it('does not double up an extension the title already carries', () => {
      expect(deriveFileName('https://z3/x/abc', 'scan.PDF', 'application/pdf')).toBe('scan.PDF');
    });

    it('does not trim the title, so a leading space cannot turn a file into a dotfile', () => {
      expect(deriveFileName('https://z3/x/abc', ' .png', 'image/png')).toBe(' .png');
    });

    it('falls back to the url file name, then to "document", when the title is blank', () => {
      expect(deriveFileName('https://z3/bucket/2026-01-01-report.pdf', '   ', undefined)).toBe('2026-01-01-report.pdf');
      expect(deriveFileName('https://z3/bucket/', '', undefined)).toBe('document');
    });
  });

  describe('sanitizeArchiveEntryName', () => {
    it('strips only characters that are illegal in file names, keeping the title readable', () => {
      expect(sanitizeArchiveEntryName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
      expect(sanitizeArchiveEntryName('Visit Note (2026-01-02), Dr. Smith.pdf')).toBe(
        'Visit Note (2026-01-02), Dr. Smith.pdf'
      );
    });
  });

  describe('resolveFileName', () => {
    it('leaves a unique name alone', () => {
      expect(resolveFileName('note.pdf', '2026-01-02T03:04:05Z', false, new Set())).toBe('note.pdf');
    });

    it('disambiguates duplicates with the document timestamp rather than an opaque counter', () => {
      expect(resolveFileName('note.pdf', '2026-01-02T03:04:05Z', true, new Set())).toBe('note_2026-01-02_03-04-05.pdf');
    });

    it('falls back to a counter when duplicates share the same timestamp', () => {
      const used = new Set<string>();
      const first = resolveFileName('note.pdf', '2026-01-02T03:04:05Z', true, used);
      const second = resolveFileName('note.pdf', '2026-01-02T03:04:05Z', true, used);
      const third = resolveFileName('note.pdf', '2026-01-02T03:04:05Z', true, used);
      expect([first, second, third]).toEqual([
        'note_2026-01-02_03-04-05.pdf',
        'note_2026-01-02_03-04-05_2.pdf',
        'note_2026-01-02_03-04-05_3.pdf',
      ]);
    });

    it('still disambiguates when a duplicate has no date to fall back on', () => {
      const used = new Set<string>();
      expect(resolveFileName('note.pdf', undefined, true, used)).toBe('note.pdf');
      expect(resolveFileName('note.pdf', undefined, true, used)).toBe('note_2.pdf');
    });
  });

  describe('nameAttachments', () => {
    it('produces a globally unique name per attachment and carries the recorded size through', () => {
      const attachments: PatientRecordAttachment[] = [
        { url: 'z3://a', title: 'Note', contentType: 'application/pdf', date: '2026-01-02T03:04:05Z', size: 10 },
        { url: 'z3://b', title: 'Note', contentType: 'application/pdf', date: '2026-02-03T04:05:06Z' },
        { url: 'z3://c', title: 'Label', contentType: 'application/pdf', date: '2026-03-04T05:06:07Z' },
      ];

      const named = nameAttachments(attachments);

      expect(named.map((entry) => entry.name)).toEqual([
        'Note_2026-01-02_03-04-05.pdf',
        'Note_2026-02-03_04-05-06.pdf',
        'Label.pdf',
      ]);
      expect(new Set(named.map((entry) => entry.name)).size).toBe(named.length);
      expect(named[0].size).toBe(10);
      expect(named[1].size).toBeUndefined();
    });

    it('returns nothing for an empty chart', () => {
      expect(nameAttachments([])).toEqual([]);
    });
  });

  describe('makeArchiveFileName', () => {
    const at = DateTime.fromISO('2026-08-21T15:45:00Z', { zone: 'utc' });

    it('names the archive after the patient and the moment it was built', () => {
      const patient = { resourceType: 'Patient', name: [{ family: 'Doe', given: ['Jane'] }] } as Patient;
      expect(makeArchiveFileName(patient, at)).toBe('medical_record_doe_jane_2026-08-21_15-45.zip');
    });

    it('falls back to "patient" when the record has no usable name', () => {
      expect(makeArchiveFileName(undefined, at)).toBe('medical_record_patient_2026-08-21_15-45.zip');
    });
  });
});

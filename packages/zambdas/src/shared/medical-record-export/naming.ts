import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { nameArchiveEntries } from 'utils/lib/utils/archive-entry-names';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { PatientRecordAttachment } from '../patient-documents';

export interface NamedAttachment {
  url: string;
  name: string;
  size?: number;
}

export const makeArchiveFileName = (patient: Patient | undefined, now: DateTime = DateTime.now()): string => {
  const name = patient?.name?.[0];
  const family = name?.family ?? 'patient';
  const given = name?.given?.[0] ?? '';
  const namePart = sanitizeFileNameForZ3([family, given].filter(Boolean).join('_').toLowerCase()) || 'patient';
  const timestamp = now.toUTC().toFormat('yyyy-MM-dd_HH-mm');
  return `medical_record_${namePart}_${timestamp}.zip`;
};

export const nameAttachments = (attachments: PatientRecordAttachment[]): NamedAttachment[] => {
  const names = nameArchiveEntries(attachments);
  return attachments.map((attachment, i) => ({
    url: attachment.url,
    name: names[i],
    size: attachment.size,
  }));
};

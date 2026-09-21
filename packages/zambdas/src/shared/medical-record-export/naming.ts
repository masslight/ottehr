import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getFileNameFromUrl, sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { PatientRecordAttachment } from '../patient-documents';

export interface NamedAttachment {
  url: string;
  name: string;
  size?: number;
}

export const deriveFileName = (url: string, title: string | undefined, contentType: string | undefined): string => {
  let name = title && title.trim() ? title : getFileNameFromUrl(url) || 'document';
  const extension = contentType?.split('/').pop();
  if (extension && !name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    name = `${name}.${extension}`;
  }
  return sanitizeArchiveEntryName(name);
};

export const sanitizeArchiveEntryName = (fileName: string): string => fileName.replace(/[/\\:*?"<>|]/g, '_');

export const splitFileName = (fileName: string): { base: string; ext: string } => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0
    ? { base: fileName.slice(0, dotIndex), ext: fileName.slice(dotIndex) }
    : { base: fileName, ext: '' };
};

export const resolveFileName = (
  baseFileName: string,
  date: string | undefined,
  disambiguate: boolean,
  usedNames: Set<string>
): string => {
  const { base, ext } = splitFileName(baseFileName);

  const timestamp = disambiguate && date ? DateTime.fromISO(date).toUTC().toFormat('yyyy-MM-dd_HH-mm-ss') : undefined;
  let candidate = timestamp ? `${base}_${timestamp}${ext}` : baseFileName;

  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${timestamp ? `${base}_${timestamp}` : base}_${counter}${ext}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

export const makeArchiveFileName = (patient: Patient | undefined, now: DateTime = DateTime.now()): string => {
  const name = patient?.name?.[0];
  const family = name?.family ?? 'patient';
  const given = name?.given?.[0] ?? '';
  const namePart = sanitizeFileNameForZ3([family, given].filter(Boolean).join('_').toLowerCase()) || 'patient';
  const timestamp = now.toUTC().toFormat('yyyy-MM-dd_HH-mm');
  return `medical_record_${namePart}_${timestamp}.zip`;
};

export const nameAttachments = (attachments: PatientRecordAttachment[]): NamedAttachment[] => {
  const baseNames = attachments.map((attachment) =>
    deriveFileName(attachment.url, attachment.title, attachment.contentType)
  );

  const nameCounts = new Map<string, number>();
  for (const baseName of baseNames) {
    nameCounts.set(baseName, (nameCounts.get(baseName) ?? 0) + 1);
  }

  const usedNames = new Set<string>();
  return attachments.map((attachment, i) => ({
    url: attachment.url,
    name: resolveFileName(baseNames[i], attachment.date, (nameCounts.get(baseNames[i]) ?? 0) > 1, usedNames),
    size: attachment.size,
  }));
};

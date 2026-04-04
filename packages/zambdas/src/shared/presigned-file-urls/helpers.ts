import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from 'utils';

type Z3UrlAudioInput = {
  secrets: Secrets | null;
  bucketName: string;
  fileName: string;
};

type Z3UrlInput =
  | {
      secrets: Secrets | null;
      bucketName: string;
      patientID: string;
      fileType: string;
      fileFormat: string;
    }
  | {
      secrets: Secrets | null;
      bucketName: string;
      patientID: string;
      fileName: string;
    };

/**
 * Sanitizes a filename for use in Z3 URLs by replacing any characters
 * that are not URL-safe with hyphens. This prevents upload failures
 * when filenames contain spaces or other special characters.
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9.\-_()]/g, '-');
};

export const makeZ3UrlForVisitAudio = (input: Z3UrlAudioInput): string => {
  const { secrets, bucketName } = input;
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  const sanitizedFileName = sanitizeFileName(input.fileName);
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${dateTimeNow}-${sanitizedFileName}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

export const makeZ3Url = (input: Z3UrlInput): string => {
  const { secrets, bucketName, patientID } = input;
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  let resolvedFileName: string;
  if ('fileName' in input) {
    resolvedFileName = sanitizeFileName(input.fileName);
  } else {
    resolvedFileName = `${input.fileType}.${input.fileFormat}`;
  }
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${patientID}/${dateTimeNow}-${resolvedFileName}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

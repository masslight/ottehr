import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

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

export const makeZ3Url = (input: Z3UrlInput): string => {
  const { secrets, bucketName, patientID } = input;
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  let resolvedFileName: string;
  if ('fileName' in input) {
    resolvedFileName = input.fileName;
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

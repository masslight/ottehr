import { DateTime } from 'luxon';
import { SAFE_FOLDER_PATH_SEGMENT_REGEX } from 'utils/lib/fhir/list';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';

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
      folderName?: string;
    }
  | {
      secrets: Secrets | null;
      bucketName: string;
      patientID: string;
      fileName: string;
      folderName?: string;
    };

/**
 * What a caller may supply to name a stored object: one path segment, nothing else.
 *
 * Must start alphanumeric, and the class excludes every character the URL parser can turn into a path
 * separator or a truncation. `/` is the obvious one; **`\` is not** — WHATWG normalises a backslash to a
 * slash in a special-scheme URL, so `a\..\..\secret.pdf` resolves clean out of the patient folder and
 * into the bucket root. `%`, `?` and `#` are excluded for the same reason: they change where the path
 * ends up rather than what it is called.
 *
 * Everything remaining is what `sanitizeFileName` and `sanitizeFileNameForZ3` are able to emit, so a name
 * this server generated is never rejected by its own check.
 */
const Z3_OBJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._+!\-'()@$]{0,199}$/;

/**
 * Builds the URL of a stored object from an object name and the context the server already holds.
 *
 * Exists so that a caller naming an object it uploaded earlier does not have to hand back a URL. The
 * presign helpers, and `deleteZ3Object`, each make an *authenticated* request to whatever URL they are
 * given — presigning is a POST to the object's own address carrying the M2M token — so a URL taken from a
 * request body is a credential to give away and an object to delete. Assembling it here means the host,
 * the bucket and the patient folder are never expressible by a caller: the only thing it supplies is the
 * name, and that cannot escape its folder.
 */
export const makeZ3ObjectUrl = (input: {
  secrets: Secrets | null;
  bucketName: string;
  /** Supplied for patient-scoped buckets, omitted for organisation-level ones. */
  patientID?: string;
  objectName: string;
}): string => {
  const { secrets, bucketName, patientID, objectName } = input;

  if (!Z3_OBJECT_NAME.test(objectName)) {
    throw new Error(`Invalid Z3 object name: ${JSON.stringify(objectName)}`);
  }

  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const patientSegment = patientID ? `${patientID}/` : '';

  return `${getSecret(SecretsKeys.PROJECT_API, secrets)}/z3/${projectId}-${bucketName}/${patientSegment}${objectName}`;
};

/** The date prefix both upload paths use, so a listing sorts by when the object arrived. */
export const z3ObjectNameDatePrefix = (): string => DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');

export const makeZ3FileUrl = (input: Z3UrlAudioInput): string => {
  const { secrets, bucketName } = input;
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  const fileURL = `${getSecret(SecretsKeys.PROJECT_API, secrets)}/z3/${projectId}-${bucketName}/${dateTimeNow}-${
    input.fileName
  }`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

export const makeZ3Url = (input: Z3UrlInput): string => {
  const { secrets, bucketName, patientID, folderName } = input;
  if (folderName !== undefined && !SAFE_FOLDER_PATH_SEGMENT_REGEX.test(folderName)) {
    throw new Error(`Invalid folderName for Z3 path: ${JSON.stringify(folderName)}`);
  }
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  let resolvedFileName: string;
  if ('fileName' in input) {
    resolvedFileName = input.fileName;
  } else {
    resolvedFileName = `${input.fileType}.${input.fileFormat}`;
  }
  const folderSegment = folderName ? `${folderName}/` : '';
  const fileURL = `${getSecret(
    SecretsKeys.PROJECT_API,
    secrets
  )}/z3/${projectId}-${bucketName}/${folderSegment}${patientID}/${dateTimeNow}-${resolvedFileName}`;
  console.log('created z3 url: ', fileURL);
  return fileURL;
};

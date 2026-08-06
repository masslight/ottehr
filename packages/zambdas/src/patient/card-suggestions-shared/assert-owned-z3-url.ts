import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';

/**
 * A tokenless caller supplies the fileURL of a file it already uploaded (via
 * get-presigned-file-url), so — unlike an authenticated EHR request — nothing here vouches for
 * which patient that file actually belongs to. makeZ3Url always embeds the patientID as a path
 * segment right after the bucket, so requiring that same prefix (built from the appointment's own
 * server-derived patientID) is what stops one patient's tokenless session from reading back OCR'd
 * PHI for a file belonging to a different patient.
 */
export function assertOwnedZ3Url(
  fileURL: string,
  secrets: Secrets | null,
  bucketName: string,
  patientID: string
): void {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const expectedPrefix = `${projectApi}/z3/${projectId}-${bucketName}/${patientID}/`;
  if (!fileURL.startsWith(expectedPrefix)) {
    throw INVALID_INPUT_ERROR('fileURL does not belong to this appointment');
  }
}

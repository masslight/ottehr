/**
 * A failure whose message is meant for the user to read. Everything else — a refused upload, a socket
 * reset, a failed FHIR write — is reported generically with the cause left in the logs, as in
 * outbound-fax. Throw this only for something the user can understand or act on.
 */
export class MedicalRecordExportUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedicalRecordExportUserError';
  }
}

export const isUserFacingExportError = (error: unknown): error is MedicalRecordExportUserError =>
  error instanceof MedicalRecordExportUserError;

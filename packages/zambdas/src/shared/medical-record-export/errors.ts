export class MedicalRecordExportUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedicalRecordExportUserError';
  }
}

export const isUserFacingExportError = (error: unknown): error is MedicalRecordExportUserError =>
  error instanceof MedicalRecordExportUserError;

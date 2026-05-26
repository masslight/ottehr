// todo sarah need to build this map out more, going to get input from product
export const FileType = {
  MEDICAL_SUMMARY: 'medical-summary',
  PROGRESS_NOTE: 'progress-note',
  INSURANCE_CARD: 'insurance-card',
  GENERATED_FORM: 'generated-form',
  OTHER: 'other',
} as const;

export type FileType = (typeof FileType)[keyof typeof FileType];

export const FileTypeLabel: Record<FileType, string> = {
  [FileType.MEDICAL_SUMMARY]: 'Medical Summary',
  [FileType.PROGRESS_NOTE]: 'Progress Note',
  [FileType.INSURANCE_CARD]: 'Insurance Card',
  [FileType.GENERATED_FORM]: 'Generated Form',
  [FileType.OTHER]: 'Other',
};

// Folder naming conventions used to infer file types from object keys
// assumes folders have been set to lowercase
export const FileTypeFolderMap: Record<FileType, string[]> = {
  [FileType.MEDICAL_SUMMARY]: ['medical_summary'],
  [FileType.INSURANCE_CARD]: ['insurancecard'],
  [FileType.PROGRESS_NOTE]: ['progressnotes', '/enc/', '/enc'],
  [FileType.GENERATED_FORM]: ['generatedform'],
  [FileType.OTHER]: [],
};

export interface LegacyFile {
  key: string;
  fileName: string;
  fileType: FileType;
  presignedUrl: string;
}

export interface LegacyPatientRecord {
  patientFolder: string;
  patientId: string;
  displayName: string;
  files: LegacyFile[];
}

export interface SearchLegacyRecordsInput {
  lastName: string;
  firstName?: string;
  dateOfBirth?: string;
  /** 1-based page index (default: 1) */
  page?: number;
  /** Patient folders per page (default: 20, max: 50) */
  pageSize?: number;
  /** Max files returned per patient record (default: 50, max: 200) */
  maxFilesPerRecord?: number;
}

export interface SearchLegacyRecordsOutput {
  results: LegacyPatientRecord[];
  /** Total number of matching patient folders (for pagination) */
  total: number;
  page: number;
  pageSize: number;
}

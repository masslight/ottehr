import { Dispatch, SetStateAction } from 'react';
import { FileUpload } from 'ottehr-utils';

export interface FileUploadOptions {
  description: string;
  onUpload: Dispatch<SetStateAction<FileUpload>>;
  uploadFile: (fileType: string, tempURL: string) => void;
  uploadFailed: boolean;
  resetUploadFailed: () => void;
  onClear: () => void;
  required?: boolean;
  fileType: string;
}

export interface MultipleFileUploadOptions {
  description: string;
  onUpload: Dispatch<SetStateAction<FileUpload>>;
  uploadFile: (fileType: string, tempURL: string) => void;
  uploadFailed: Record<string, boolean>;
  resetUploadFailed: (fileType: string) => void;
  onClear: (fileType: string) => void;
  required?: boolean;
  fileType: string;
  loading?: boolean;
}

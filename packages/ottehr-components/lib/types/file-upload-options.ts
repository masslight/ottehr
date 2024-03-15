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

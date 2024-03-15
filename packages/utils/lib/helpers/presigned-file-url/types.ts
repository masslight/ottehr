import { Secrets } from '../../secrets';

export interface GetPresignedFileURLInput {
  appointmentID: string;
  fileType: 'photo-id-front' | 'photo-id-back' | 'insurance-card-front' | 'insurance-card-back';
  fileFormat: 'jpg' | 'jpeg' | 'png';
  secrets: Secrets | null;
}

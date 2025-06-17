import { FileURLs } from '../../common';
import { PaperworkResponse } from '../paperwork.types';

export interface CreatePaperworkInput {
  appointmentID: string;
  paperwork: PaperworkResponse[];
  files: FileURLs;
  paperworkComplete?: boolean;
  ipAddress: string;
  timezone: string;
  patientId: string;
}

export interface CreatePaperworkResponse {
  message: string;
}

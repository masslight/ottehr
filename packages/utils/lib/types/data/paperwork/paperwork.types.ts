import { FileURLs } from '../../common';

export interface UpdatePaperworkInput {
  appointmentID: string;
  paperwork: PaperworkResponse[];
  files: FileURLs;
  paperworkComplete: boolean;
  ipAddress: string;
}

export interface PaperworkResponse {
  linkId: string;
  response: any;
  type: string;
}

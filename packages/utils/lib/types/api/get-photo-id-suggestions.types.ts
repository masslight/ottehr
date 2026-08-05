import { PhotoIdExtractionFields } from '../data';

export interface GetPhotoIdSuggestionsInput {
  appointmentID: string;
  fileURL: string;
  fileContentType?: string;
}

export interface GetPhotoIdSuggestionsResponse {
  isPhotoId: boolean;
  notAPhotoId?: boolean;
  fields: PhotoIdExtractionFields | null;
}

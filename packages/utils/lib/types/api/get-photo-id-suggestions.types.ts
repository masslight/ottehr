import { PhotoIdExtractionFields } from '../data/documents';

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

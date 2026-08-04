import { PhotoIdExtractionFields } from '../data';

export interface GetPhotoIdSuggestionsInput {
  appointmentID: string;
  fileURL: string;
  // Deliberately not named "contentType": the Oystehr SDK's executePublic sniffs a top-level
  // MIME-shaped `contentType` key to decide whether a single-argument call is params or options,
  // and misclassifies this payload (dropping the path {id} param) if that key is present.
  fileContentType?: string;
}

export interface GetPhotoIdSuggestionsResponse {
  isPhotoId: boolean;
  notAPhotoId?: boolean;
  fields: PhotoIdExtractionFields | null;
}

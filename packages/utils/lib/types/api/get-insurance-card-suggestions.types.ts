import { InsuranceCardExtractionFields } from '../data';

export interface GetInsuranceCardSuggestionsInput {
  appointmentID: string;
  fileURL: string;
  // Deliberately not named "contentType": the Oystehr SDK's executePublic sniffs a top-level
  // MIME-shaped `contentType` key to decide whether a single-argument call is params or options,
  // and misclassifies this payload (dropping the path {id} param) if that key is present.
  fileContentType?: string;
}

export interface GetInsuranceCardSuggestionsResponse {
  isInsuranceCard: boolean;
  notACard?: boolean;
  readable: boolean | null;
  fields: InsuranceCardExtractionFields | null;
}

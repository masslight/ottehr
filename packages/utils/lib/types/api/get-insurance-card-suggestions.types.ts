import { InsuranceCardExtractionFields } from '../data/documents';

export interface GetInsuranceCardSuggestionsInput {
  appointmentID: string;
  fileURL: string;
  fileContentType?: string;
}

export interface GetInsuranceCardSuggestionsResponse {
  isInsuranceCard: boolean;
  notACard?: boolean;
  readable: boolean | null;
  fields: InsuranceCardExtractionFields | null;
}

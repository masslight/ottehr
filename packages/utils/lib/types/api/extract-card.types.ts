import { InsuranceCardExtractionFields, PhotoIdExtractionFields } from '../data/documents';

export interface ExtractCardInput {
  documentReferenceId: string;
}

export interface ExtractCardResponse {
  documentReferenceId: string;
  skipped?: boolean;
  skipReason?: string;
  alreadyProcessed?: boolean;
  extracted?: boolean;
  notACard?: boolean;
  notAPhotoId?: boolean;
  fields?: InsuranceCardExtractionFields | PhotoIdExtractionFields | null;
}

export enum DocumentType {
  InsuranceFront = 'insurance-card-front',
  InsuranceBack = 'insurance-card-back',
  FullInsurance = 'fullInsuranceCard',
  InsuranceFrontSecondary = 'insurance-card-front-2',
  InsuranceBackSecondary = 'insurance-card-back-2',
  FullInsuranceSecondary = 'fullInsuranceCard-2',
  PhotoIdFront = 'photo-id-front',
  PhotoIdBack = 'photo-id-back',
  FullPhotoId = 'fullPhotoIDCard',
  HipaaConsent = 'HIPAA Acknowledgement',
  CttConsent = 'Consent to Treat, Guarantee of Payment & Card on File Agreement',
  CttConsentOld = 'Consent to Treat and Guarantee of Payment',
}
export interface DocumentInfo {
  type: DocumentType;
  z3Url: string;
  presignedUrl: string | undefined;
  code?: string;
}

export interface VisitDocuments {
  photoIdCards: DocumentInfo[];
  insuranceCards: DocumentInfo[];
  insuranceCardsSecondary: DocumentInfo[];
  fullCardPdfs: DocumentInfo[];
  consentPdfUrls: string[];
}

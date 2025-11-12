import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Color, PDFFont, PDFImage, StandardFonts } from 'pdf-lib';
import {
  ExternalLabOrderResult,
  Gender,
  InHouseLabResult as InHouseLabResultPdfData,
  LabType,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  ObservationDTO,
  QuantityComponent,
  SupportedObsImgAttachmentTypes,
  VitalsVisitNoteData,
} from 'utils';
import { testDataForOrderForm } from '../../ehr/submit-lab-order/helpers';
import { Column } from './pdf-utils';

export interface PageElementStyle {
  side?: 'left' | 'right' | 'center';
}

export interface PerimeterDimensions {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export interface TextStyle extends PageElementStyle {
  font: PDFFont;
  fontSize: number;
  spacing: number;
  color?: Color;
  newLineAfter?: boolean;
  weight?: number;
}

export interface ImageStyle extends PageElementStyle {
  width: number;
  height: number;
  margin?: PerimeterDimensions;
  center?: boolean;
}

export interface PdfClientStyles {
  initialPage: PageStyles;
}

export interface PageStyles {
  height: number;
  width: number;
  pageMargins: PerimeterDimensions;
  setHeadline?: () => void;
}

export interface LineStyle {
  thickness: number;
  color?: Color;
  margin?: PerimeterDimensions;
}

export interface PdfClient {
  addNewPage: (styles: PageStyles) => void;
  drawText: (text: string, textStyle: TextStyle) => void;
  drawTextSequential: (
    text: string,
    textStyle: Exclude<TextStyle, 'side'>,
    bounds?: { leftBound: number; rightBound: number }
  ) => void;
  drawStartXPosSpecifiedText: (
    text: string,
    textStyle: TextStyle,
    startingXPos: number,
    bounds?: { leftBound: number; rightBound: number }
  ) => { endXPos: number; endYPos: number };
  drawImage: (img: PDFImage, styles: ImageStyle, textStyle?: TextStyle) => void;
  newLine: (yDrop: number) => void;
  getX: () => number;
  getY: () => number;
  setX: (x: number) => void;
  setY: (y: number) => void;
  save: () => Promise<Uint8Array>;
  embedFont: (path: Buffer) => Promise<PDFFont>;
  embedStandardFont: (font: StandardFonts) => Promise<PDFFont>;
  embedImage: (file: Buffer) => Promise<PDFImage>;
  embedPdfFromBase64: (base64String: string) => Promise<void>;
  embedImageFromBase64: (base64String: string, imgType: SupportedObsImgAttachmentTypes) => Promise<void>;
  drawSeparatedLine: (lineStyle: LineStyle) => void;
  getLeftBound: () => number;
  getRightBound: () => number;
  setLeftBound: (newBound: number) => void;
  setRightBound: (newBound: number) => void;
  getTextDimensions: (text: string, textStyle: TextStyle) => { width: number; height: number };
  setPageStyles: (newStyles: PageStyles) => void;
  drawVariableWidthColumns: (columns: Column[], yPosStartOfColumn: number, startPageIndex: number) => void;
  getCurrentPageIndex: () => number;
  setPageByIndex: (pageIndex: number) => void;
  getTotalPages: () => number;
  drawLink: (text: string, url: string, textStyle: TextStyle) => void;
  numberPages: (textStyle: TextStyle) => void;
}

export interface PdfExaminationBlockData {
  examination: {
    [group: string]: {
      items?: Array<{
        field: string;
        label: string;
        abnormal: boolean;
      }>;
      comment?: string;
    };
  };
}

// todo might make sense to have a separate interface for the order pdf base
// and the result pdf base
interface LabsData {
  locationName?: string;
  locationStreetAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  locationPhone?: string;
  locationFax?: string;
  accountNumber: string;
  orderNumber: string; // this is only for external labs
  providerName: string;
  providerNPI: string | undefined;
  patientFirstName: string;
  patientMiddleName: string | undefined;
  patientLastName: string;
  patientSex: string;
  patientDOB: string;
  patientId: string;
  patientAddress: string;
  patientPhone: string;
  todayDate: string;
  orderSubmitDate: string;
  dateIncludedInFileName: string;
  orderAssessments: { code: string; name: string }[];
  orderPriority: string;
  isManualOrder: boolean;
  isPscOrder: boolean;
}

export type OrderFormInsuranceInfo = {
  insuranceRank: number;
  insuredName?: string;
  insuredAddress?: string;
  insuranceName?: string;
  insuranceAddress?: string;
  insuranceSubNum?: string;
};
export interface ExternalLabOrderFormData extends Omit<LabsData, 'orderAssessments'> {
  labOrganizationName: string;
  billClass: string;
  testDetails: testDataForOrderForm[];
  insuranceDetails?: OrderFormInsuranceInfo[];
}

export interface ExternalLabResult {
  resultCodeAndDisplay: string;
  loincCodeAndDisplay: string;
  snowmedDisplay: string;
  resultInterpretation?: string;
  resultInterpretationDisplay?: string;
  resultValue: string;
  referenceRangeText?: string;
  resultNotes?: string[];
  attachmentText?: string;
  performingLabName?: string;
  performingLabAddress?: string;
  performingLabPhone?: string;
  performingLabDirectorFullName?: string;
  observationStatus: string;
  additionalLabCode: string | undefined;
}

export interface InHouseLabResult {
  name: string;
  type: string;
  value: string | undefined;
  units?: string;
  rangeString?: string[];
  rangeQuantity?: QuantityComponent;
}
export interface InHouseLabResultConfig {
  collectionDate: string;
  finalResultDateTime: DateTime;
  specimenSource: string;
  results: InHouseLabResult[];
}

export type ResultSpecimenInfo = {
  quantityString?: string;
  unit?: string;
  bodySite?: string;
  collectedDateTime?: string;
};

export interface LabResultsData
  extends Omit<
    LabsData,
    | 'orderNumber'
    | 'labOrganizationName'
    | 'orderSubmitDate'
    | 'providerTitle'
    | 'patientAddress'
    | 'sampleCollectionDate'
    | 'billClass'
    | 'isManualOrder'
  > {
  testName: string;
  resultStatus: string;
  abnormalResult?: boolean;
  patientVisitNote?: string;
  clinicalInfo?: string;
  fastingStatus?: string;
  resultSpecimenInfo?: ResultSpecimenInfo;
}

// will be arrays of base64 encoded strings
export interface ExternalLabResultAttachments {
  pdfAttachments: string[];
  pngAttachments: string[];
  jpgAttachments: string[];
}
export interface ExternalLabResultsData extends LabResultsData {
  orderNumber: string;
  alternatePlacerId: string | undefined;
  accessionNumber: string;
  orderSubmitDate: string;
  collectionDate: string;
  resultsReceivedDate: string;
  reviewed?: boolean; // todo why is this possibly undefined ??
  reviewingProvider: Practitioner | undefined;
  reviewDate: string | undefined;
  resultInterpretations: string[];
  attachments: ExternalLabResultAttachments;
  externalLabResults: ExternalLabResult[];
  testItemCode: string;
}

export type ReflexExternalLabResultsData = Omit<ExternalLabResultsData, 'orderSubmitDate'>;

export type UnsolicitedExternalLabResultsData = Omit<ExternalLabResultsData, 'orderNumber' | 'orderSubmitDate'>;

export interface InHouseLabResultsData
  extends Omit<
    LabResultsData,
    'accountNumber' | 'patientVisitNote' | 'clinicalInfo' | 'fastingStatus' | 'resultSpecimenInfo'
  > {
  inHouseLabResults: InHouseLabResultConfig[];
  timezone: string | undefined;
  serviceRequestID: string;
  orderCreateDate: string;
}

export type ResultDataConfig =
  | { type: LabType.external; data: ExternalLabResultsData }
  | { type: LabType.inHouse; data: InHouseLabResultsData }
  | { type: LabType.unsolicited; data: UnsolicitedExternalLabResultsData }
  | { type: LabType.reflex; data: ReflexExternalLabResultsData }
  | { type: LabType.pdfAttachment; data: ReflexExternalLabResultsData };

export interface VisitNoteData extends PdfExaminationBlockData {
  patientName: string;
  patientDOB: string;
  personAccompanying: string;
  patientPhone: string;
  dateOfService: string;
  reasonForVisit: string;
  provider: string;
  intakePerson?: string;
  signedOn: string;
  visitID: string;
  visitState: string;
  insuranceCompany?: string;
  insuranceSubscriberId?: string;
  address: string;
  chiefComplaint?: string;
  providerTimeSpan?: string;
  reviewOfSystems?: string;
  medications?: string[];
  medicationsNotes?: string[];
  allergies?: string[];
  allergiesNotes?: string[];
  medicalConditions?: string[];
  medicalConditionsNotes?: string[];
  inHouseLabs?: { orders: LabOrder[]; results: InHouseLabResultPdfData[] };
  externalLabs?: { orders: LabOrder[]; results: ExternalLabOrderResult[] };
  surgicalHistory?: string[];
  surgicalHistoryNotes?: string[];
  inHouseMedications?: string[];
  inHouseMedicationsNotes?: string[];
  immunizationOrders?: string[];
  screening?: {
    additionalQuestions: { [fieldFhirId: string]: ObservationDTO };
    currentASQ?: string;
    notes?: string[];
  };
  hospitalization?: string[];
  hospitalizationNotes?: string[];
  vitals?: VitalsVisitNoteData & {
    notes?: string[];
  };
  intakeNotes?: string[];
  assessment?: {
    primary: string;
    secondary: string[];
  };
  medicalDecision?: string;
  emCode?: string;
  cptCodes?: string[];
  prescriptions: string[];
  patientInstructions?: string[];
  disposition: {
    header: string;
    text: string;
    [NOTHING_TO_EAT_OR_DRINK_FIELD]?: boolean;
    labService: string;
    virusTest: string;
    followUpIn?: number;
    reason?: string;
  };
  subSpecialtyFollowUp?: string[];
  workSchoolExcuse?: string[];
  procedures?: {
    procedureType?: string;
    cptCodes?: string[];
    diagnoses?: string[];
    procedureDateTime?: string;
    performerType?: string;
    medicationUsed?: string;
    bodySite?: string;
    bodySide?: string;
    technique?: string;
    suppliesUsed?: string;
    procedureDetails?: string;
    specimenSent?: string;
    complications?: string;
    patientResponse?: string;
    postInstructions?: string;
    timeSpent?: string;
    documentedBy?: string;
  }[];
  addendumNote?: string;
}

export interface ReceiptData {
  facility?: {
    name: string;
    address: string;
    phone: string;
  };
  patient: {
    name: string;
    dob: string;
    account: string;
  };
  amount: string;
  date: string;
}

export interface Medication {
  name: string;
  dose?: string;
  route?: string;
  date?: string;
}

export interface PrescribedMedication {
  name?: string;
  instructions?: string;
  date?: string;
}

export interface LabOrder {
  serviceRequestId: string;
  testItemName: string;
}

export type DischargeSummaryData = {
  patient: {
    fullName: string;
    dob: string;
    sex: Gender;
    id: string;
    phone?: string;
  };
  visit: {
    type: string;
    time: string;
    date: string;
    location?: string;
    reasonForVisit: string;
  };
  vitals: {
    temp?: string;
    hr?: string;
    rr?: string;
    bp?: string;
    oxygenSat?: string;
    weight?: string;
    height?: string;
    vision?: string;
  };
  currentMedications?: string[];
  currentMedicationsNotes?: string[];
  allergies?: string[];
  allergiesNotes?: string[];
  inHouseLabs?: { orders: LabOrder[]; results: InHouseLabResultPdfData[] };
  externalLabs?: { orders: LabOrder[]; results: ExternalLabOrderResult[] };
  radiology?: {
    name: string;
    result?: string;
  }[];
  inhouseMedications?: Medication[];
  erxMedications?: PrescribedMedication[];
  diagnoses?: {
    primary: string[];
    secondary: string[];
  };
  patientInstructions?: string[];
  educationDocuments?: { title: string }[];
  disposition: {
    label: string;
    instruction: string;
    reason?: string;
    followUpIn?: string;
  };
  physician: {
    name: string;
  };
  dischargeDateTime?: string;
  workSchoolExcuse?: { note: string }[];
  documentsAttached?: boolean;
  attachmentDocRefs?: string[];
};

export interface GetPaymentDataResponse {
  chargeUuid: string;
  amount: number;
  currency: string;
  date: string;
  card: {
    brand: string;
    lastFour: string;
    expirationMonth: number;
    expirationYear: number;
  };
}

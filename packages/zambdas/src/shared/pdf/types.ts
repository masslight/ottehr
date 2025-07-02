import { Practitioner } from 'fhir/r4b';
import { Color, PDFFont, PDFImage, StandardFonts } from 'pdf-lib';
import {
  AdditionalBooleanQuestionsFieldsNames,
  ExamObservationFieldItem,
  ExamTabCardNames,
  InPersonExamObservationFieldItem,
  InPersonExamTabProviderCardNames,
  LabType,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  QuantityComponent,
  VitalsVisitNoteData,
} from 'utils';

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
  drawTextSequential: (text: string, textStyle: Exclude<TextStyle, 'side'>, leftIndentationXPos?: number) => void;
  drawStartXPosSpecifiedText: (
    text: string,
    textStyle: TextStyle,
    startingXPos: number
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
  drawSeparatedLine: (lineStyle: LineStyle) => void;
  getLeftBound: () => number;
  getRightBound: () => number;
  setLeftBound: (newBound: number) => void;
  setRightBound: (newBound: number) => void;
  getTextDimensions: (text: string, textStyle: TextStyle) => { width: number; height: number };
  setPageStyles: (newStyles: PageStyles) => void;
}

export type TelemedExamBlockData = {
  [group in Exclude<ExamTabCardNames, 'vitals'>]: {
    items?: ExamObservationFieldItem[];
    extraItems?: string[];
    leftItems?: ExamObservationFieldItem[];
    rightItems?: ExamObservationFieldItem[];
    comment?: string;
  };
} & {
  vitals: {
    temp: string;
    pulseOx: string;
    hr: string;
    rr: string;
    bp: string;
  };
};

export type InPersonExamBlockData = {
  [group in InPersonExamTabProviderCardNames]: {
    items?: InPersonExamObservationFieldItem[];
    comment?: string;
  };
};

export interface ExaminationBlockData {
  examination: TelemedExamBlockData | InPersonExamBlockData;
}

// todo might make sense to have a separate interface for the order pdf base
// and the result pdf base
export interface LabsData {
  locationName?: string;
  locationStreetAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  locationPhone?: string;
  locationFax?: string;
  labOrganizationName: string; // this is only mapped for order pdf
  serviceRequestID: string;
  orderNumber: string; // this is only for external
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
  orderCreateDate: string;
  sampleCollectionDate?: string;
  primaryInsuranceName?: string;
  primaryInsuranceAddress?: string;
  primaryInsuranceSubNum?: string;
  insuredName?: string;
  insuredAddress?: string;
  aoeAnswers?: { question: string; answer: any }[]; // this is only for external
  orderName?: string | undefined;
  orderAssessments: { code: string; name: string }[];
  orderPriority: string;
}

export interface ExternalLabResult {
  resultCode: string;
  resultCodeDisplay: string;
  resultInterpretation?: string;
  resultInterpretationDisplay?: string;
  resultValue: string;
  referenceRangeText?: string;
  resultNotes?: string[];
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
  finalResultDateTime: string;
  specimenSource: string;
  results: InHouseLabResult[];
}

export interface LabResultsData
  extends Omit<
    LabsData,
    | 'aoeAnswers'
    | 'orderNumber'
    | 'labOrganizationName'
    | 'orderSubmitDate'
    | 'providerTitle'
    | 'providerNPI'
    | 'patientAddress'
    | 'sampleCollectionDate'
  > {
  testName: string;
  resultStatus: string;
  abnormalResult?: boolean;
}
export interface ExternalLabResultsData extends LabResultsData {
  orderNumber: string;
  accessionNumber: string;
  orderSubmitDate: string;
  collectionDate: string;
  resultPhase: string;
  resultsReceivedDate: string;
  reviewed?: boolean;
  reviewingProvider: Practitioner | undefined;
  reviewDate: string | undefined;
  resultInterpretations: string[];
  externalLabResults: ExternalLabResult[];
  testItemCode: string;
  performingLabName: string;
  performingLabAddress?: string;
  performingLabDirector?: string;
  performingLabPhone?: string;
  performingLabDirectorFullName?: string;
}
export interface InHouseLabResultsData extends LabResultsData {
  inHouseLabResults: InHouseLabResultConfig[];
}

export type ResultDataConfig =
  | { type: LabType.external; data: ExternalLabResultsData }
  | { type: LabType.inHouse; data: InHouseLabResultsData };

export interface VisitNoteData extends ExaminationBlockData {
  patientName: string;
  patientDOB: string;
  personAccompanying: string;
  patientPhone: string;
  dateOfService: string;
  reasonForVisit: string;
  provider: string;
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
  allergies?: string[];
  medicalConditions?: string[];
  surgicalHistory?: string[];
  additionalQuestions: Record<AdditionalBooleanQuestionsFieldsNames, string>;
  screening?: {
    seenInLastThreeYears?: string;
    historyObtainedFrom?: string;
    historyObtainedFromOther?: string;
    currentASQ?: string;
    notes?: string[];
  };
  hospitalization?: string[];
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

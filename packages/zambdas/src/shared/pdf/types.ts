import { Color, PDFFont, PDFImage, StandardFonts } from 'pdf-lib';
import {
  AdditionalBooleanQuestionsFieldsNames,
  ExamObservationFieldItem,
  ExamTabCardNames,
  InPersonExamObservationFieldItem,
  InPersonExamTabProviderCardNames,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
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
  drawTextSequential: (text: string, textStyle: Exclude<TextStyle, 'side'>) => void;
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

export interface ExternalLabsData {
  locationName?: string;
  locationStreetAddress?: string;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  locationPhone?: string;
  locationFax?: string;
  labOrganizationName: string;
  reqId: string;
  providerName: string;
  providerTitle: string;
  providerNPI: string;
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
  aoeAnswers?: { question: string; answer: any }[];
  orderName?: string | undefined;
  orderAssessments: { code: string; name: string }[];
  orderPriority: string;
} // TODO: change this based on the actual data we need to send to submit-labs endpoint

export interface ExternalLabResult {
  resultCode: string;
  resultCodeDisplay: string;
  resultInterpretation?: string;
  resultInterpretationDisplay?: string;
  resultValue: string;
}

export interface InHouseLabResult {
  name: string;
  value: string | undefined;
  units?: string;
  range: string;
}

export interface LabResultsData extends ExternalLabsData {
  accessionNumber: string;
  requisitionNumber?: string;
  // orderReceived: string;
  // specimenReceived: string;
  // reportDate: string;
  // specimenSource: string;
  testName: string;
  // specimenDescription: string;
  specimenReferenceRange?: string;
  resultPhase: string;
  resultStatus: string;
  reviewed?: boolean;
  reviewingProviderFirst: string;
  reviewingProviderLast: string;
  reviewingProviderTitle: string;
  collectionDate: string;
  reviewDate: string | undefined;
  resultInterpretations: string[];
  externalLabResults?: ExternalLabResult[];
  inHouseLabResults?: InHouseLabResult[];
  testItemCode: string;
  performingLabName: string;
  performingLabStreetAddress: string;
  performingLabCity: string;
  performingLabState: string;
  performingLabZip: string;
  performingLabDirector?: string;
  performingLabPhone: string;
  performingLabDirectorFirstName: string;
  performingLabDirectorLastName: string;
  performingLabDirectorTitle: string;
  abnormalResult?: boolean;
} // TODO: change this based on the actual data brought in by the DORN webhook

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

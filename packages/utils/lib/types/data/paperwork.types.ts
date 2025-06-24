import { HealthcareService, Location, QuestionnaireResponse } from 'fhir/r4b';
import { OptionConfig } from '../../helpers';
import { AvailableLocationInformation, FileURLs, FormItemType } from '../common';
import { AppointmentSummary, IntakeQuestionnaireItem, PaperworkPatient } from './paperwork/paperwork.types';

export type QuestionOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=' | undefined;

export interface Question {
  id: string;
  text: string;
  type: FormItemType;
  hidden?: boolean;
  item?: Question[];
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  infoText?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  infoTextSecondary?: string;
  required?: boolean;
  width?: number;
  options?: OptionConfig[];
  attachmentText?: string;
  format?: string;
  docType?: string;
  autoComplete?: string;
  freeSelectMultiple?: boolean;
  submitOnChange?: boolean;
  disableError?: boolean;
  freeSelectFreeSolo?: boolean;
  virtualization?: boolean;
  fileUploadType?: string;
  enableWhen?: {
    question: string;
    operator: QuestionOperator;
    answer: string;
  };
  requireWhen?: {
    question: string;
    operator: QuestionOperator;
    answer: string;
  };
  disableWhen?: {
    question: string;
    operator: QuestionOperator;
    answer: string;
    value?: string;
  };
}

export interface PaperworkPage {
  page: string;
  reviewPageName?: string;
  slug: string;
  questions: Question[];
}

export interface GetPaperworkRequestParams {
  appointmentID: string;
  dateOfBirth?: string;
}

export interface GetPaperworkResponse {
  appointment: AppointmentSummary;
  patient: PaperworkPatient;
  allItems: IntakeQuestionnaireItem[];
  questionnaireResponse: QuestionnaireResponse | undefined;
}

export interface PaperworkResponseWithoutResponses {
  message: string;
  appointment: {
    start: string;
    location: AvailableLocationInformation;
  };
  questions: PaperworkPage[];
  paperworkComplete: boolean;
}

export type PaperworkResponseWithResponses = PaperworkResponseWithoutResponses & {
  paperwork: any;
  files?: FileURLs;
};

export interface InsuranceRequestParameters {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  idNumber: string;
  insurance: Insurance;
}

export enum Insurance {
  'self-pay' = 'self-pay',
  'Fidelis Care' = 'Fidelis Care',
  'Healthfirst' = 'Healthfirst',
  'Point Comfort' = 'Point Comfort',
  // 'United Healthcare' = 'United Healthcare',
}

export interface PaperworkResponse {
  linkId: string;
  response: any;
  type: string;
}

export interface HealthcareServiceWithLocationContext {
  hs: HealthcareService;
  locations?: Location[];
  coverageArea?: Location[];
}

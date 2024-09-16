import { AvailableLocationInformation, FileURLs, FormItemType } from '../common';
import { OptionConfig } from '../../helpers';

export type QuestionOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=' | undefined;

export interface Question {
  id: string;
  text: string;
  type: FormItemType;
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
  submitOnChange?: boolean;
  disableError?: boolean;
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

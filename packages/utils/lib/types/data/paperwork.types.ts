import { AvailableLocationInformation, FileURLs, FormItemType } from '../common';

export type QuestionOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=' | undefined;

export interface Question {
  id: string;
  text: string;
  type: FormItemType;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  infoText?: string;
  required?: boolean;
  width?: number;
  options?: string[];
  attachmentText?: string;
  format?: string;
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

export interface UpdatePaperworkParams {
  appointmentID: string;
  paperwork: any;
  files?: FileURLs;
}

export interface UpdatePaperworkResponse {
  message: string;
}

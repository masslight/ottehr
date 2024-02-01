import { ReactElement } from 'react';
import { PatientInfo, VisitType } from '../store/types';
import { Address, ContactPoint, LocationHoursOfOperation } from 'fhir/r4';

export interface CreateAppointmentParameters {
  slot?: string | undefined;
  patient: PatientInfo | undefined;
  location?: string | undefined;
  visitType: VisitType | undefined;
  unconfirmedDateOfBirth?: string | undefined;
}

export interface CancelAppointmentParameters {
  appointmentID: string;
  cancellationReason: string;
}

export interface UpdateAppointmentParameters {
  appointmentID: string;
  slot: string | undefined;
}

export interface UpdatePaperworkParameters {
  appointmentID: string;
  paperwork: any;
  files?: FileURLs;
}

export interface GetLocationParameters {
  locationSlug?: string | undefined;
}

export interface GetPaperworkParameters {
  appointmentID?: string;
  patientID?: string;
}

export const ReasonForVisitOptions = [
  'Cough and/or congestion',
  'Fever',
  'Throat pain',
  'Ear pain',
  'Vomiting and/or diarrhea',
  'Abdominal (belly) pain',
  'Rash or skin issue',
  'Urinary problem',
  'Breathing problem',
  'Injury to arms or legs',
  'Injury to head or fall on head',
  'Cut to arms or legs',
  'Cut to face or head',
  'Choked or swallowed something',
  'Allergic reaction',
];

export const fileFormats = ['jpg', 'jpeg', 'png'];

export interface RadioOption {
  label?: string;
  value: string;
  description?: string | ReactElement;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  color?: string;
  borderColor?: string;
}

export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  timezone: string | undefined;
}

interface PaperworkResponseWithoutResponses {
  message: string;
  appointment: {
    start: string;
    location: AvailableLocationInformation;
    visitType: VisitType;
    status?: string;
  };
  questions: PaperworkPage[];
  paperworkCompleteOrInProgress: boolean;
}

export type PaperworkResponseWithResponses = PaperworkResponseWithoutResponses & {
  paperwork: any;
  files?: FileURLs;
};

export type FormItemType =
  | 'Text'
  | 'Select'
  | 'Radio'
  | 'Radio List'
  | 'Free Select'
  | 'Date'
  | 'File'
  | 'Checkbox'
  | 'Header 3'
  | 'Description'
  | undefined;

export interface PaperworkPage {
  page: string;
  reviewPageName?: string;
  slug: string;
  questions: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: FormItemType;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  infoText?: string;
  infoTextSecondary?: string;
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

export type QuestionOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=' | undefined;

export interface FileUpload {
  [key: string]: {
    fileData: File | null;
    uploadFailed: boolean;
  };
}

export interface FileURLs {
  [key: string]: {
    localUrl?: string;
    presignedUrl?: string;
    z3Url?: string;
  };
}

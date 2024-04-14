import { VisitStatusHistoryEntry, VisitStatus } from './shared/fhirStatusMappingUtils';

export interface Secrets {
  [secretName: string]: string;
}

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}

export interface ZambdaFunctionInput<TInputParams> {
  body: TInputParams;
  secrets: Secrets | null;
}
export interface ZambdaFunctionResponse<TResponse> {
  error?: unknown;
  response?: TResponse;
}
export interface AppointmentInformation {
  id?: string;
  start: string;
  patient: {
    id?: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  unconfirmedDOB: string;
  reasonForVisit: string;
  comment: string | undefined;
  appointmentType?: AppointmentType;
  appointmentStatus: string;
  status: VisitStatus;
  cancellationReason: string | undefined;
  paperwork: {
    demographics: boolean;
    photoID: boolean;
    insuranceCard: boolean;
    consent: boolean;
  };
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  needsDOBConfirmation: boolean | undefined;
}

export type AppointmentType = 'walk-in' | 'pre-booked';

import { ReactElement } from 'react';
import { VisitStatusLabel } from 'utils';

export interface UpdatePaperworkParameters {
  appointmentID: string;
  inProgress: string;
}

export interface GetAppointmentParameters {
  patientID?: string;
  dateRange?: { greaterThan: string; lessThan: string }; // if no date range is passed, all appointment from today onwards will be returned
}

export interface GetPaperworkParameters {
  appointmentID: string;
  dateOfBirth?: string;
}

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
export interface FileUpload {
  [key: string]: {
    fileData: File | null;
    uploadFailed: boolean;
  };
}

export interface Appointment {
  id: string;
  patientID: string;
  firstName: string;
  middleName: string;
  lastName: string;
  start: string;
  status: string;
  location?: { name: string; slug: string; state: string; timezone: string };
  paperworkComplete: boolean;
  checkedIn: boolean;
  visitType: string;
  visitStatus: VisitStatusLabel;
  slotId?: string;
}

export type EmailUserValue = 'Patient (Self)' | 'Parent/Guardian';

import { ReactElement } from 'react';

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

export type EmailUserValue = 'Patient (Self)' | 'Parent/Guardian';

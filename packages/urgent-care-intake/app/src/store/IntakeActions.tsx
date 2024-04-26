import { Dispatch } from 'react';
import { IntakeAction, PatientInfo, VisitType } from './types';
import { AvailableLocationInformation } from '../api/zapehrApi';
import { FileURLs, PaperworkPage } from '../types/types';

export const updateVisitType = (visitType: VisitType, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'SET_VISIT_TYPE',
    visitType: visitType,
  });
};

export const updatePatients = (patients: PatientInfo[], dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_PATIENTS',
    patients: patients,
  });
};

export const updatePatient = (patient: PatientInfo | undefined, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_PATIENT',
    patient: patient,
  });
};

export const updateSelectedLocation = (
  location: AvailableLocationInformation,
  dispatch: Dispatch<IntakeAction>,
): void => {
  dispatch({
    type: 'UPDATE_SELECTED_LOCATION',
    location: location,
  });
};

export const updateAppointmentSlot = (appointmentSlot: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_APPOINTMENT_SLOT',
    appointmentSlot: appointmentSlot,
  });
};

export const updateAppointmentID = (appointmentID: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_APPOINTMENT_ID',
    appointmentID: appointmentID,
  });
};

export const updateNetworkError = (networkError: boolean, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_NETWORK_ERROR',
    networkError: networkError,
  });
};

export const updatePaperworkQuestions = (
  paperworkQuestions: PaperworkPage[],
  dispatch: Dispatch<IntakeAction>,
): void => {
  dispatch({
    type: 'UPDATE_PAPERWORK_QUESTIONS',
    paperworkQuestions: paperworkQuestions,
  });
};

export const updateCompletedPaperwork = (completedPaperwork: any, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_COMPLETED_PAPERWORK',
    completedPaperwork: completedPaperwork,
  });
};

export const updateFileURLs = (fileURLs: FileURLs, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_FILE_URLS',
    fileURLs: fileURLs,
  });
};

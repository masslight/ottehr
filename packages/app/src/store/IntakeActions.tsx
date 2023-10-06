import { Dispatch } from 'react';
import { Location, Patient, Slot } from 'fhir/r4';
import { IntakeAction, PatientInfo } from './types';
import { FhirClient, ZambdaClient } from '@zapehr/sdk';

export const setFhirClient = (token: string, dispatch: Dispatch<IntakeAction>): void => {
  const fhirClient = new FhirClient({
    apiUrl: import.meta.env.VITE_FHIR_API_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_FHIR_CLIENT',
    fhirClient: fhirClient,
  });
};

export const setZambdaClient = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const zambdaClient = new ZambdaClient({
    apiUrl: import.meta.env.VITE_PROJECT_API_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_ZAMBDA_CLIENT',
    zambdaClient: zambdaClient,
  });
};

export const updatePhoneNumber = (phoneNumber: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_PHONE_NUMBER',
    phoneNumber: phoneNumber,
  });
};

export const updateSubmittedInsuranceType = ({ type }: { type: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_SUBMITTED_INSURANCE_TYPE',
    submittedInsuranceType: type,
  });
};

export const updateCoverageId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_COVERAGE_ID',
    coverageId: id,
  });
};

export const updateResponsiblePartyId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_RESPONSIBLE_PARTY_ID',
    responsiblePartyId: id,
  });
};

export const updateRelatedPersonId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_RELATED_PERSON_ID',
    relatedPersonId: id,
  });
};

export const updateConsentFormSignerId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_CONSENT_FORM_SIGNER_ID',
    consentFormSignerId: id,
  });
};

export const updateConsentFormId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_CONSENT_FORM_ID',
    consentFormId: id,
  });
};

export const updatePatients = (patients: Patient[], dispatch: Dispatch<IntakeAction>): void => {
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

export const updateLocationId = (location: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_LOCATION_ID',
    locationId: location.id,
  });
};

export const updateSelectedAppointmentSlotId = ({ id }: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID',
    selectedApptSlotId: id,
  });
};

export const updateLocations = (locations: Location[], dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_LOCATIONS',
    locations: locations,
  });
};

export const updateSelectedLocation = (location: Location, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_SELECTED_LOCATION',
    location: location,
  });
};

export const updateSlots = (slots: Slot[], dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_SLOTS',
    slots: slots,
  });
};

export const updateAppointmentSlot = (appointmentSlot: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_APPOINTMENT_SLOT',
    appointmentSlot: appointmentSlot,
  });
};

export const updateAppointmentId = (appointment: { id: string }, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_APPOINTMENT_ID',
    appointmentId: appointment.id,
  });
};

export const updateAdditionalInformation = (additionalInfo: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_ADDITIONAL_INFORMATION',
    additionalInformation: additionalInfo,
  });
};

export const updateCancellationReason = (cancellationReason: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_CANCELLATION_REASON',
    cancellationReason: cancellationReason,
  });
};

export const updateTimezone = (timezone: string, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'UPDATE_TIMEZONE',
    timezone: timezone,
  });
};

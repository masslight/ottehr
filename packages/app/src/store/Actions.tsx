import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Location, Patient, Slot } from 'fhir/r4';
import { Dispatch } from 'react';
import { Action, PatientInfo } from './types';

export const setFhirClient = (token: string, dispatch: Dispatch<Action>): void => {
  const fhirClient = new FhirClient({
    accessToken: token,
    apiUrl: import.meta.env.VITE_FHIR_API_URL,
  });
  dispatch({
    fhirClient,
    type: 'SET_FHIR_CLIENT',
  });
};

export const setZambdaClient = (token: string | undefined, dispatch: Dispatch<Action>): void => {
  const zambdaClient = new ZambdaClient({
    accessToken: token,
    apiUrl: import.meta.env.VITE_PROJECT_API_URL,
  });
  dispatch({
    type: 'SET_ZAMBDA_CLIENT',
    zambdaClient,
  });
};

export const updateAdditionalInformation = (additionalInfo: string, dispatch: Dispatch<Action>): void => {
  dispatch({
    additionalInformation: additionalInfo,
    type: 'UPDATE_ADDITIONAL_INFORMATION',
  });
};

export const updateAppointmentId = (appointment: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    appointmentId: appointment.id,
    type: 'UPDATE_APPOINTMENT_ID',
  });
};

// TODO Shouldn't this be a slot?
export const updateAppointmentSlot = (appointmentSlot: string, dispatch: Dispatch<Action>): void => {
  dispatch({
    appointmentSlot,
    type: 'UPDATE_APPOINTMENT_SLOT',
  });
};

export const updateCancellationReason = (cancellationReason: string, dispatch: Dispatch<Action>): void => {
  dispatch({
    cancellationReason,
    type: 'UPDATE_CANCELLATION_REASON',
  });
};

export const updateConsentFormId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    consentFormId: id,
    type: 'UPDATE_CONSENT_FORM_ID',
  });
};

export const updateConsentFormSignerId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    consentFormSignerId: id,
    type: 'UPDATE_CONSENT_FORM_SIGNER_ID',
  });
};

export const updateCoverageId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    coverageId: id,
    type: 'UPDATE_COVERAGE_ID',
  });
};

export const updateLocationId = (location: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    locationId: location.id,
    type: 'UPDATE_LOCATION_ID',
  });
};

export const updateLocations = (locations: Location[], dispatch: Dispatch<Action>): void => {
  dispatch({
    locations,
    type: 'UPDATE_LOCATIONS',
  });
};

export const updatePatient = (patient: PatientInfo | undefined, dispatch: Dispatch<Action>): void => {
  dispatch({
    patient,
    type: 'UPDATE_PATIENT',
  });
};

export const updatePatients = (patients: Patient[], dispatch: Dispatch<Action>): void => {
  dispatch({
    patients,
    type: 'UPDATE_PATIENTS',
  });
};

export const updatePhoneNumber = (phoneNumber: string, dispatch: Dispatch<Action>): void => {
  dispatch({
    phoneNumber,
    type: 'UPDATE_PHONE_NUMBER',
  });
};

export const updateRelatedPersonId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    relatedPersonId: id,
    type: 'UPDATE_RELATED_PERSON_ID',
  });
};

export const updateResponsiblePartyId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    responsiblePartyId: id,
    type: 'UPDATE_RESPONSIBLE_PARTY_ID',
  });
};

export const updateSelectedAppointmentSlotId = ({ id }: { id: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    selectedApptSlotId: id,
    type: 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID',
  });
};

export const updateSelectedLocation = (selectedLocation: Location, dispatch: Dispatch<Action>): void => {
  dispatch({
    selectedLocation,
    type: 'UPDATE_SELECTED_LOCATION',
  });
};

export const updateSlots = (slots: Slot[], dispatch: Dispatch<Action>): void => {
  dispatch({
    slots,
    type: 'UPDATE_SLOTS',
  });
};

export const updateSubmittedInsuranceType = ({ type }: { type: string }, dispatch: Dispatch<Action>): void => {
  dispatch({
    submittedInsuranceType: type,
    type: 'UPDATE_SUBMITTED_INSURANCE_TYPE',
  });
};

export const updateTimezone = (timezone: string, dispatch: Dispatch<Action>): void => {
  dispatch({
    timezone,
    type: 'UPDATE_TIMEZONE',
  });
};

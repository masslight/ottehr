import { Locator } from '@playwright/test';
import { PatientBasicInfo } from 'tests/utils/BaseFlow';
import { SlotAndLocation } from 'tests/utils/in-person/BaseInPersonFlow';
import {
  EmergencyContactData,
  EmployerInformationData,
  FlagsData,
  InsuranceOptionalData,
  InsuranceRequiredData,
  PatientDetailsData,
  PatientDetailsRequiredData,
  PrimaryCarePhysicianData,
  ResponsiblePartyData,
  TelemedPaperworkData,
} from 'tests/utils/Paperwork';
import { GetSlotDetailsResponse } from 'utils';

// common interfaces

interface InsurancePayment {
  insuranceData: {
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  };
  secondaryInsuranceData: {
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  };
}

interface MinimumAppointmentData {
  appointmentId: string;
}

// in-person interfaces

interface InPersonMinimumPaperworkData {
  state: string;
  employerInformation: EmployerInformationData | null;
  emergencyContact: EmergencyContactData | null;
}

interface CancelledSlotDetails extends GetSlotDetailsResponse {
  appointmentId: string;
}

// in-person patients

export interface InPersonNoRpNoInsReqPatient
  extends PatientBasicInfo,
    MinimumAppointmentData,
    SlotAndLocation,
    InPersonMinimumPaperworkData {
  patientDetailsData: PatientDetailsRequiredData;
  slotDetails: Omit<GetSlotDetailsResponse, 'appointmentId'>;
  cancelledSlotDetails: CancelledSlotDetails;
}

export interface InPersonRpInsNoReqPatient
  extends PatientBasicInfo,
    MinimumAppointmentData,
    SlotAndLocation,
    InPersonMinimumPaperworkData,
    InsurancePayment {
  patientDetailsData: PatientDetailsData;
  slotDetails: Omit<GetSlotDetailsResponse, 'appointmentId'>;
  cancelledSlotDetails: CancelledSlotDetails;
  pcpData: PrimaryCarePhysicianData;
  responsiblePartyData: ResponsiblePartyData;
}

export interface InPersonNoPwPatient extends PatientBasicInfo, MinimumAppointmentData {}

export interface InPersonReservationModificationPatient extends PatientBasicInfo, MinimumAppointmentData {
  slotDetails: GetSlotDetailsResponse;
}

// telemed interfaces

interface TelemedMinimumPaperworkData {
  location: string | null | undefined;
  state: string;
}

// telemed patients

export interface TelemedNoRpNoInsReqPatient
  extends PatientBasicInfo,
    MinimumAppointmentData,
    TelemedMinimumPaperworkData {
  patientDetailsData: PatientDetailsRequiredData;
}

export interface TelemedRpInsNoReqPatient
  extends PatientBasicInfo,
    MinimumAppointmentData,
    TelemedMinimumPaperworkData,
    InsurancePayment {
  patientDetailsData: PatientDetailsData;
  pcpData: PrimaryCarePhysicianData;
  responsiblePartyData: ResponsiblePartyData;
  medicationData: TelemedPaperworkData;
  allergiesData: TelemedPaperworkData;
  medicalHistoryData: TelemedPaperworkData;
  surgicalHistoryData: TelemedPaperworkData;
  flags: FlagsData;
  uploadedPhotoCondition: Locator;
}

export interface TelemedWaitingRoomPatient
  extends PatientBasicInfo,
    MinimumAppointmentData,
    TelemedMinimumPaperworkData {}

export interface TelemedNoPwPatient extends PatientBasicInfo, MinimumAppointmentData {}

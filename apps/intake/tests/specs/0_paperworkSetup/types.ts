import { Locator } from '@playwright/test';
import { PatientBasicInfo as InPersonPatientBasicInfo, SlotAndLocation } from 'tests/utils/in-person/BaseInPersonFlow';
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
import { PatientBasicInfo as TelemedPatientBasicInfo } from 'tests/utils/telemed/BaseTelemedFlow';
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
  extends InPersonPatientBasicInfo,
    MinimumAppointmentData,
    SlotAndLocation,
    InPersonMinimumPaperworkData {
  patientDetailsData: PatientDetailsRequiredData;
  slotDetails: Omit<GetSlotDetailsResponse, 'appointmentId'>;
  cancelledSlotDetails: CancelledSlotDetails;
}

export interface InPersonRpInsNoReqPatient
  extends InPersonPatientBasicInfo,
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

export interface InPersonNoPwPatient extends InPersonPatientBasicInfo, MinimumAppointmentData {}

export interface InPersonReservationModificationPatient extends InPersonPatientBasicInfo, MinimumAppointmentData {
  slotDetails: GetSlotDetailsResponse;
}

// telemed interfaces

interface TelemedMinimumPaperworkData {
  location: string | null | undefined;
  state: string;
}

// telemed patients

export interface TelemedNoRpNoInsReqPatient
  extends TelemedPatientBasicInfo,
    MinimumAppointmentData,
    TelemedMinimumPaperworkData {
  patientDetailsData: PatientDetailsRequiredData;
}

export interface TelemedRpInsNoReqPatient
  extends TelemedPatientBasicInfo,
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
  extends TelemedPatientBasicInfo,
    MinimumAppointmentData,
    TelemedMinimumPaperworkData {}

export interface TelemedNoPwPatient extends TelemedPatientBasicInfo, MinimumAppointmentData {}

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

// in-person interfaces

interface InPersonMinimumAppointmentData {
  appointmentId: string;
}

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
    InPersonMinimumAppointmentData,
    SlotAndLocation,
    InPersonMinimumPaperworkData {
  patientDetailsData: PatientDetailsRequiredData;
  slotDetails: Omit<GetSlotDetailsResponse, 'appointmentId'>;
  cancelledSlotDetails: CancelledSlotDetails;
}

export interface InPersonRpInsNoReqPatient
  extends InPersonPatientBasicInfo,
    InPersonMinimumAppointmentData,
    SlotAndLocation,
    InPersonMinimumPaperworkData,
    InsurancePayment {
  patientDetailsData: PatientDetailsData;
  slotDetails: Omit<GetSlotDetailsResponse, 'appointmentId'>;
  cancelledSlotDetails: CancelledSlotDetails;
  pcpData: PrimaryCarePhysicianData;
  responsiblePartyData: ResponsiblePartyData;
}

export interface InPersonNoPwPatient extends InPersonPatientBasicInfo, InPersonMinimumAppointmentData {}

export interface InPersonReservationModificationPatient
  extends InPersonPatientBasicInfo,
    InPersonMinimumAppointmentData {
  slotDetails: GetSlotDetailsResponse;
}

// telemed interfaces

// telemed patients

// TelemedRpInsNoReqPatient
// TelemedNoRpNoInsReqPatient
// TelemedWaitingRoomPatient
// TelemedNoPwPatient

export interface TelemedPatientTestData {
  firstName: string;
  lastName: string;
  email: string;
  birthSex: string;
  dob: {
    m: string;
    d: string;
    y: string;
  };
  appointmentId: string | null;
}

export interface TelemedPrebookPatientTestData extends TelemedPatientTestData {
  state: string;
  patientDetailsData: PatientDetailsData;
  pcpData: PrimaryCarePhysicianData;
  insuranceData: {
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  } | null;
  secondaryInsuranceData: {
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  } | null;
  responsiblePartyData: ResponsiblePartyData | null;
  medicationData: TelemedPaperworkData;
  allergiesData: TelemedPaperworkData;
  medicalHistoryData: TelemedPaperworkData;
  surgicalHistoryData: TelemedPaperworkData;
  flags: FlagsData;
  uploadedPhotoCondition: Locator;
}

export interface TelemedWalkInPatientTestData extends TelemedPatientTestData {
  state: string;
  location: string | null | undefined;
}

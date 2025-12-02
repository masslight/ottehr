import {
  InsuranceOptionalData,
  InsuranceRequiredData,
  PatientDetailsData,
  PrimaryCarePhysicianData,
  ResponsibleParty,
} from 'tests/utils/Paperwork';
import { GetSlotDetailsResponse } from 'utils';

export interface InPersonPatientTestData {
  firstName: string;
  lastName: string;
  email: string;
  birthSex: string;
  dateOfBirth: string;
  appointmentId: string;
  slot: string | undefined;
  location: string | null;
  slotDetails: GetSlotDetailsResponse;
}

export interface InPersonPatientSelfTestData extends InPersonPatientTestData {
  state: string;
  cancelledSlotDetails: { appointmentId: string } & GetSlotDetailsResponse;
}

export interface InPersonPatientNotSelfTestData extends InPersonPatientTestData {
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
  responsiblePartyData: ResponsibleParty;
}

export interface TelemedPatientTestData {
  firstName: string;
  lastName: string;
  email: string;
  birthSex: string;
  dateOfBirth: {
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
  responsiblePartyData: ResponsibleParty;
  medicationData: TelemedPaperworkData;
  allergiesData: TelemedPaperworkData;
  medicalHistoryData: TelemedPaperworkData;
  surgicalHistoryData: TelemedPaperworkData;
  flags: Flags;
  uploadedPhotoCondition: Locator;
}

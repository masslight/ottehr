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

import {
  InsuranceOptionalData,
  InsuranceRequiredData,
  PatientDetailsData,
  PrimaryCarePhysicianData,
  ResponsibleParty,
} from 'tests/utils/Paperwork';

export interface InPersonPatientTestData {
  firstName: string;
  lastName: string;
  email: string;
  birthSex: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  appointmentId: string;
  slot: string | undefined;
  location: string | null;
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

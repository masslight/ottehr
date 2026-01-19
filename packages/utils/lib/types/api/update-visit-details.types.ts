import { Attachment } from 'fhir/r4b';
import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
} from '../data';

export interface BookingDetails {
  reasonForVisit?: string;
  additionalDetails?: string;
  authorizedNonLegalGuardians?: string;
  confirmedDob?: string;
  patientName?: {
    first?: string;
    middle?: string;
    last?: string;
    suffix?: string;
  };
  consentForms?: {
    consentAttested: boolean;
  };
  serviceCategory?: string;
}

export interface UpdateVisitDetailsInput {
  appointmentId: string;
  bookingDetails: BookingDetails;
}

export const ValidEHRUploadTypes = [
  PHOTO_ID_FRONT_ID,
  PHOTO_ID_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_BACK_2_ID,
] as const;

export type EHRImageUploadType = (typeof ValidEHRUploadTypes)[number];

// UpdateVisitFilesInput is a bit of a misnomer because the only files we can update via this zambda are
// patient-record-level files (insurance / id cards). nonetheless, ehr users at this time can only
// view and edit these files via the visit details page. In the future, it could expand to other file types
// that are scoped to the particular visit, at which point an appointment id param would become necessary,
// and the patient id param would not be. For now, making both optional and validating presence of one or the other.
export interface UpdateVisitFilesInput {
  patientId?: string;
  appointmentId?: string;
  fileType: EHRImageUploadType;
  attachment: Attachment;
}

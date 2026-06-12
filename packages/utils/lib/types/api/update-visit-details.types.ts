import { Attachment, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { isValidUUID } from '../../validation';
import { REASON_ADDITIONAL_MAX_CHAR } from '../../validation/constants';
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
  /** Reference to Organization (occupational-medicine-employer). `null` clears the visit-level employer. */
  visitOccupationalMedicineEmployer?: Reference | null;
}

export interface UpdateVisitDetailsInput {
  appointmentId: string;
  bookingDetails: BookingDetails;
}

const ORGANIZATION_REFERENCE_PREFIX = 'Organization/';
const organizationReferenceSchema = z
  .string()
  .refine(
    (val) =>
      val.startsWith(ORGANIZATION_REFERENCE_PREFIX) && isValidUUID(val.slice(ORGANIZATION_REFERENCE_PREFIX.length)),
    { message: 'reference must be Organization/{uuid}' }
  );

export const FhirOrganizationReferenceSchema = z.object({
  reference: organizationReferenceSchema,
  display: z.string().optional(),
  type: z.string().optional(),
});

const confirmedDobSchema = z.string().refine(
  (value) => DateTime.fromISO(value).isValid,
  (value) => ({
    message: `confirmedDob, "${value}", is not a valid iso date string`,
  })
);

const patientNameSchema = z
  .object({
    first: z.string().optional(),
    middle: z.string().optional(),
    last: z.string().optional(),
    suffix: z.string().optional(),
  })
  // Empty object would overwrite the stored name with undefined.
  .refine((name) => Object.values(name).some((value) => value !== undefined), {
    message: '"patientName" must have at least one field defined',
  })
  .refine((name) => name.first === undefined || name.first.trim().length > 0, {
    message: 'patientName must have a non-empty first name',
  })
  .refine((name) => name.last === undefined || name.last.trim().length > 0, {
    message: 'patientName must have a non-empty last name',
  });

export const BookingDetailsSchema = z
  .object({
    reasonForVisit: z.string().optional(),
    additionalDetails: z.string().max(REASON_ADDITIONAL_MAX_CHAR).optional(),
    authorizedNonLegalGuardians: z.string().optional(),
    confirmedDob: confirmedDobSchema.optional(),
    patientName: patientNameSchema.optional(),
    consentForms: z
      .object({
        consentAttested: z.boolean(),
      })
      .optional(),
    serviceCategory: z.string().optional(),
    visitOccupationalMedicineEmployer: z.union([FhirOrganizationReferenceSchema, z.null()]).optional(),
  })
  .refine(
    (data) =>
      data.reasonForVisit !== undefined ||
      data.additionalDetails !== undefined ||
      data.authorizedNonLegalGuardians !== undefined ||
      data.confirmedDob !== undefined ||
      data.patientName !== undefined ||
      data.consentForms !== undefined ||
      data.serviceCategory !== undefined ||
      data.visitOccupationalMedicineEmployer !== undefined,
    { message: 'at least one field in bookingDetails must be provided' }
  );

export const UpdateVisitDetailsRequestSchema = z.object({
  appointmentId: z.string().uuid(),
  bookingDetails: BookingDetailsSchema,
});

export type UpdateVisitDetailsRequest = z.infer<typeof UpdateVisitDetailsRequestSchema>;

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

export interface DeleteVisitFilesInput {
  documentId: string;
  patientId: string;
}

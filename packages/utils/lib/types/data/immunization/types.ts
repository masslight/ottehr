import { ImmunizationForecast, ImmunizationGroupId, ProjectedDoses } from '../../../immunization-forecast/types';
import { VaccineFundingSource, VfcEligibilityCode } from './vfc';

export interface ImmunizationOrderDetails {
  medication: {
    id: string;
    name: string;
  };
  dose: string;
  units: string;
  orderedProvider: {
    id: string;
    name: string;
  };
  orderedDateTime: string;
  route?: string;
  location?: {
    name: string;
    code: string;
  };
  instructions?: string;
  associatedDx?: {
    resourceId: string;
    display: string;
  };
  manufacturer?: string;
}

export interface ImmunizationEmergencyContact {
  relationship: string;
  fullName: string;
  mobile: string;
}

/** A CPT code billed with the administration; `billableUnits` is the claim quantity (90461 ×5), 1 when absent. */
export interface ImmunizationCptCode {
  code: string;
  display: string;
  billableUnits?: number;
}

export interface ImmunizationOrderAdministrationDetails {
  lot: string;
  expDate: string;
  mvx: string;
  cvx: string;
  cptCodes?: ImmunizationCptCode[];
  ndc: string;
  /** The stock the dose came from, when the lot was picked from inventory. */
  fundingSource?: VaccineFundingSource;
  /** The patient's VFC eligibility on the day. */
  vfcEligibility?: VfcEligibilityCode;
  /** Why the dose was taken from the other stock (VFC stock for a non-eligible patient or the reverse). */
  borrowingReason?: string;
  administeredProvider: {
    id: string;
    name: string;
  };
  administeredDateTime: string;
  visGiven?: boolean;
  visGivenDate?: string;
  emergencyContact?: ImmunizationEmergencyContact;
}

export interface ImmunizationOrder {
  id: string;
  status: string;
  reason?: string;
  details: ImmunizationOrderDetails;
  administrationDetails?: ImmunizationOrderAdministrationDetails;
  encounterId: string;
}

export type InputImmunizationOrderDetails = Omit<ImmunizationOrderDetails, 'orderedDateTime'>;

// Administration fields that can be entered at order time, before administration
export type InputImmunizationOrderAdministrationDetails = Partial<
  Omit<ImmunizationOrderAdministrationDetails, 'administeredProvider' | 'emergencyContact'>
>;

export interface CreateUpdateImmunizationOrderRequest {
  orderId?: string;
  encounterId: string;
  details: InputImmunizationOrderDetails;
  administrationDetails?: InputImmunizationOrderAdministrationDetails;
}

export interface CreateUpdateImmunizationOrderResponse {
  orderId: string;
}

export interface GetImmunizationOrdersRequest {
  orderId?: string;
  patientId?: string;
  encounterIds?: string[];
}

export interface GetImmunizationOrdersResponse {
  orders: ImmunizationOrder[];
}

export interface AdministerImmunizationOrderRequest {
  orderId: string;
  type: 'administered' | 'administered-partly' | 'administered-not';
  reason?: string;
  details: InputImmunizationOrderDetails;
  administrationDetails: Omit<ImmunizationOrderAdministrationDetails, 'administeredProvider'>;
}

export interface CancelImmunizationOrderRequest {
  orderId: string;
}

export interface CancelImmunizationOrderResponse {
  retainedCptCodes: string[];
  billingReviewRequired: boolean;
}

export interface Vaccine {
  id: string;
  name: string;
  /** From the vaccine's catalog entry; fills the dose's CVX. */
  cvx?: string;
}

export interface GetVaccinesResponse {
  vaccines: Vaccine[];
}

// ── Immunization records (FHIR Immunization): doses given here, outside doses and per-vaccine marks ──

/** Where an outside dose's information came from: the CDC NIP001 list registries take for historical doses. */
export type ImmunizationOutsideSource =
  | 'written-record'
  | 'other-provider'
  | 'recall'
  | 'other-registry'
  | 'school-record'
  | 'birth-certificate'
  | 'public-agency';

/** A dose administered externally, as the order screen's external line holds it. Only the vaccine is required. */
export interface OutsideImmunizationDetails {
  vaccine: { id?: string; name: string };
  cvx?: string;
  /** ISO date; absent when the exact date is not known. */
  dateGiven?: string;
  place?: string;
  source?: ImmunizationOutsideSource;
  lot?: string;
  manufacturer?: string;
  mvx?: string;
}

export interface RecordOutsideImmunizationRequest extends OutsideImmunizationDetails {
  encounterId: string;
}

export interface RecordOutsideImmunizationResponse {
  immunizationId: string;
}

export type ImmunizationMarkType = 'immune' | 'contraindicated' | 'declined';

export interface SaveImmunizationMarkRequest {
  patientId: string;
  /** A vaccine group code from VACCINE_GROUPS. */
  vaccineGroup: string;
  mark: ImmunizationMarkType;
  note?: string;
}

export interface SaveImmunizationMarkResponse {
  markId: string;
}

export interface ClearImmunizationMarkRequest {
  markId: string;
}

export interface ClearImmunizationMarkResponse {
  markId: string;
}

export interface GetPatientImmunizationsRequest {
  patientId: string;
}

export interface ImmunizationActor {
  id?: string;
  name: string;
}

/** One dose in the patient's immunization history: given here (from an administered order) or outside. */
export interface PatientImmunizationRecord {
  id: string;
  vaccineName: string;
  cvx?: string;
  outside: boolean;
  /** ISO date-time (given here) or date (outside); absent when the date is unknown. */
  dateGiven?: string;
  dateUnknown: boolean;
  administeredBy?: ImmunizationActor;
  place?: string;
  source?: ImmunizationOutsideSource | 'unspecified';
  /** The CDC NIP001 code behind `source` ('04' = recall), as the forecast engine reads it. */
  sourceCode?: string;
  lot?: string;
  expirationDate?: string;
  manufacturer?: string;
  mvx?: string;
  medicationAdministrationId?: string;
  encounterId?: string;
  recorded?: string;
}

/** A per-vaccine mark with its history: a cleared mark stays, with who cleared it and when. */
export interface ImmunizationMark {
  id: string;
  vaccineGroup: { code: string; display: string };
  mark: ImmunizationMarkType;
  markedAt: string;
  markedBy: ImmunizationActor;
  note?: string;
  cleared?: { at: string; by: ImmunizationActor };
}

export interface GetPatientImmunizationsResponse {
  immunizations: PatientImmunizationRecord[];
  marks: ImmunizationMark[];
}

// ── Forecast (the engine run server-side) and the immunization record PDF ──

export interface GetImmunizationForecastRequest {
  patientId: string;
  /** The visit the forecast is for: its day is the assessment date. The encounter must be the patient's. */
  encounterId?: string;
  /** Assessment date, ISO yyyy-mm-dd, when there is no visit; today when both are absent. */
  asOf?: string;
}

/** The forecast computed server-side from the patient's records, with the records it was computed from. */
export interface GetImmunizationForecastResponse extends GetPatientImmunizationsResponse {
  forecast: ImmunizationForecast;
  /** Display only: the timeline's later doses, if each is given on time. Due today never reads it. */
  projections?: ProjectedDoses;
  /** Every CVX code the rules know → the groups it covers, so the Due today box can map stocked vaccines. */
  cvxGroups: Record<string, ImmunizationGroupId[]>;
  /** The patient's date of birth, ISO yyyy-mm-dd; the timeline places doses by age. */
  dob: string;
}

export interface CreateImmunizationRecordRequest {
  appointmentId: string;
}

export interface CreateImmunizationRecordResponse {
  message: string;
  documentId: string;
}

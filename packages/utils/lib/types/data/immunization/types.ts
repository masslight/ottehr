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

export interface ImmunizationOrderAdministrationDetails {
  lot: string;
  expDate: string;
  mvx: string;
  cvx: string;
  cptCodes?: { code: string; display: string }[];
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

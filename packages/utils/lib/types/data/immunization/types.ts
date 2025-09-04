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
  location?: string;
  instructions?: string;
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
  cpt?: string;
  ndc: string;
  administeredProvider: {
    id: string;
    name: string;
  };
  administeredDateTime: string;
  visGivenDate?: string;
  emergencyContact?: ImmunizationEmergencyContact;
}

export interface ImmunizationOrder {
  id: string;
  status: string;
  reason?: string;
  details: ImmunizationOrderDetails;
  administrationDetails?: ImmunizationOrderAdministrationDetails;
}

export interface InputImmunizationOrderDetails
  extends Omit<ImmunizationOrderDetails, 'orderedDateTime' | 'medication' | 'orderedProvider'> {
  medicationId: string;
  orderedProviderId: string;
}

export interface CreateUpdateImmunizationOrderRequest {
  orderId?: string;
  encounterId: string;
  details: InputImmunizationOrderDetails;
}

export interface CreateUpdateImmunizationOrderResponse {
  orderId: string;
}

export interface GetImmunizationOrdersRequest {
  orderId?: string;
  patientId?: string;
  encounterId?: string;
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

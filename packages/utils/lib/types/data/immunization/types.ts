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
  orderId: string;
  status: string;
  reason?: string;
  details: ImmunizationOrderDetails;
  administrationDetails?: ImmunizationOrderAdministrationDetails;
}

export interface InputOrderDetails
  extends Omit<ImmunizationOrderDetails, 'orderedDateTime' | 'medication' | 'orderedProvider'> {
  medicationId: string;
  orderedProviderId: string;
}

export interface CreateUpdateImmunizationOrderInput {
  orderId?: string;
  encounterId: string;
  details: InputOrderDetails;
}

export interface GetImmunizationOrdersInput {
  orderId?: string;
  patientId?: string;
}

export interface AdministerImmunizationOrderInput {
  orderId: string;
  type: 'administered' | 'administered-partly' | 'administered-not';
  reason?: string;
  orderDetails: ImmunizationOrderDetails;
  administrationDetails: ImmunizationOrderAdministrationDetails;
}

export interface CancelImmunizationOrderInput {
  orderId: string;
}

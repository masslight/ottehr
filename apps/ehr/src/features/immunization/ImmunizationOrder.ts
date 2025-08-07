import { DateTime } from 'luxon';

export const STUB_IMMUNIZATION_ORDERS: ImmunizationOrder[] = [
  {
    id: 'order-1',
    vaccineName: 'Albuterol',
    vaccineId: '6047ed6d-51a0-4afe-8f1e-2e009d37383c',
    dose: '5',
    units: 'mg',
    route: '26643006',
    location: 'location-a',
    instructions: 'instructions',
    status: 'pending',
    orderedBy: {
      providerName: 'Bohdan Demo',
      providerId: '30144c68-2422-4cbc-a21f-b15af079c965',
    },
    orderedDateTime: DateTime.now(),
    administeringData: {
      lot: 'lot2',
      expDate: 'expDate2',
      mvx: 'mvx2',
      cvx: 'cvx2',
      cpt: 'cpt2',
      ndc: 'ndc2',
      administeredDateTime: DateTime.now(),
      visGivenDate: DateTime.now(),
      providerName: 'administeredProviderName2',
      providerId: 'administeredProviderId2',
    },
    emergencyContact: {
      relationship: 'parent',
      fullName: 'fullname',
      mobile: 'mobile',
    },
  },
  {
    id: 'order-2',
    vaccineName: 'Albuterol',
    vaccineId: '6047ed6d-51a0-4afe-8f1e-2e009d37383c',
    dose: '10',
    units: 'ml',
    route: '26643006',
    location: 'location-a',
    instructions: 'instructions',
    status: 'administered',
    statusReason: 'patient ok',
    orderedBy: {
      providerName: 'Bohdan Demo',
      providerId: '30144c68-2422-4cbc-a21f-b15af079c965',
    },
    orderedDateTime: DateTime.now(),
    administeringData: {
      lot: 'lot',
      expDate: 'expDate',
      mvx: 'mvx',
      cvx: 'cvx',
      cpt: 'cpt',
      ndc: 'ndc',
      administeredDateTime: DateTime.now(),
      visGivenDate: DateTime.now(),
      providerName: 'administeredProviderName',
      providerId: 'administeredProviderId',
    },
    emergencyContact: {
      relationship: 'parent',
      fullName: 'fullname',
      mobile: 'mobile',
    },
  },
];

export interface ImmunizationOrder {
  id: string;
  vaccineName: string;
  vaccineId: string;
  dose: string;
  units: string;
  route?: string;
  location?: string;
  instructions?: string;
  status: 'pending' | 'administered' | 'partly-administered' | 'not-administered' | 'cancelled';
  statusReason?: string;
  orderedBy: {
    providerName: string;
    providerId: string;
  };
  orderedDateTime: DateTime;
  administeringData?: {
    lot: string;
    expDate: string;
    mvx: string;
    cvx: string;
    cpt?: string;
    ndc: string;
    administeredDateTime: DateTime;
    visGivenDate?: DateTime;
    providerName: string;
    providerId: string;
  };
  emergencyContact?: {
    relationship?: string;
    fullName?: string;
    mobile?: string;
  };
}

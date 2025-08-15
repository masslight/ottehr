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
    orderedDateTime: DateTime.now().toISO(),
    administeringData: {
      lot: 'lot2',
      expDate: DateTime.now().toISO(),
      mvx: 'mvx2',
      cvx: 'cvx2',
      cpt: 'cpt2',
      ndc: 'ndc2',
      administeredDateTime: DateTime.now().toISO(),
      visGivenDate: DateTime.now().toISO(),
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
    dose: '6',
    units: 'ml',
    status: 'pending',
    orderedBy: {
      providerName: 'Bohdan Demo',
      providerId: '30144c68-2422-4cbc-a21f-b15af079c965',
    },
    orderedDateTime: DateTime.now().toISO(),
  },
  {
    id: 'order-3',
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
    orderedDateTime: DateTime.now().toISO(),
    administeringData: {
      lot: 'lot',
      expDate: DateTime.now().toISO(),
      mvx: 'mvx',
      cvx: 'cvx',
      cpt: 'cpt',
      ndc: 'ndc',
      administeredDateTime: DateTime.now().toISO(),
      visGivenDate: DateTime.now().toISO(),
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
  orderedDateTime: string;
  administeringData?: {
    lot: string;
    expDate: string;
    mvx: string;
    cvx: string;
    cpt?: string;
    ndc: string;
    administeredDateTime: string;
    visGivenDate?: string;
    providerName: string;
    providerId: string;
  };
  emergencyContact?: {
    relationship?: string;
    fullName?: string;
    mobile?: string;
  };
}

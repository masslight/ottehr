export const STUB_IMMUNIZATION_ORDERS: ImmunizationOrder[] = [
  {
    id: 'order-1',
    vaccineName: 'TdaP',
    vaccineId: 'tdap-id',
    dose: '5',
    units: 'mg',
    status: 'pending',
    orderedBy: {
      providerName: 'Stub provider',
      privioderId: 'stub-provider-id',
    },
    orderedDate: 'orderedDate',
    orderedTime: 'orderedTime',
  },
  {
    id: 'order-2',
    vaccineName: 'Tetanus',
    vaccineId: 'tetanus-id',
    dose: '10',
    units: 'ml',
    route: 'route',
    location: 'location',
    instructions: 'instructions',
    status: 'administered',
    orderedBy: {
      providerName: 'Stub provider 2',
      privioderId: 'stub-provider-id-2',
    },
    orderedDate: 'orderedDate',
    orderedTime: 'orderedTime',
    administeringData: {
      lot: 'lot',
      expDate: 'expDate',
      mvx: 'mvx',
      cvx: 'cvx',
      cpt: 'cpt',
      ndc: 'ndc',
      administeredDate: 'administeredDate',
      administeredTime: 'administeredTime',
      visGivenDate: 'visGivenDate',
      providerName: 'administeredProviderName',
      privioderId: 'administeredProviderId',
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
  status: string;
  statusReason?: string;
  orderedBy: {
    providerName: string;
    privioderId: string;
  };
  orderedDate: string;
  orderedTime: string;
  administeringData?: {
    lot: string;
    expDate: string;
    mvx: string;
    cvx: string;
    cpt?: string;
    ndc: string;
    administeredDate: string;
    administeredTime: string;
    visGivenDate?: string;
    providerName: string;
    privioderId: string;
  };
  emergencyContact?: {
    relationship?: string;
    fullName?: string;
    mobile?: string;
  };
}

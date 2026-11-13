import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import type { FetchMock } from '../../harness/story';
import { appointmentMocks, userMocks } from './shared-mocks';

export const mockImmunizationOrder: ImmunizationOrder = {
  id: 'imm-order-1',
  status: 'pending',
  encounterId: 'encounter-1',
  details: {
    medication: { id: 'med-1', name: 'Influenza, seasonal, injectable, preservative free' },
    dose: '0.5',
    units: 'mL',
    route: '78421000',
    location: { name: 'Left Deltoid', code: 'LD' },
    instructions: 'Observe for 15 minutes after administration.',
    orderedProvider: { id: 'practitioner-1', name: 'Olivia Bennett, MD' },
    orderedDateTime: '2026-11-10T15:20:00.000Z',
    manufacturer: 'Sanofi Pasteur',
  },
  administrationDetails: {
    lot: 'U7421AA',
    expDate: '2027-06-30',
    mvx: 'PMC',
    cvx: '150',
    ndc: '49281-0421-50',
    cptCodes: [{ code: '90686', display: 'Influenza virus vaccine, quadrivalent, preservative free, 0.5 mL' }],
    administeredProvider: { id: 'practitioner-1', name: 'Olivia Bennett, MD' },
    administeredDateTime: '2026-11-10T15:45:00.000Z',
    visGiven: true,
    visGivenDate: '2026-11-10',
  },
};

export const mockImmunizationQuickPicks: ImmunizationQuickPickData[] = [
  {
    id: 'qp-imm-1',
    name: 'Flu shot 0.5 mL IM | lot: U7421AA',
    vaccine: { id: 'med-1', name: 'Influenza, seasonal, injectable, preservative free' },
    dose: '0.5',
    units: 'mL',
    route: '78421000',
    manufacturer: 'Sanofi Pasteur',
    lot: 'U7421AA',
    expDate: '2027-06-30',
    mvx: 'PMC',
    cvx: '150',
    ndc: '49281-0421-50',
  },
  {
    id: 'qp-imm-2',
    name: 'Tdap 0.5 mL IM',
    vaccine: { id: 'med-2', name: 'Tdap' },
    dose: '0.5',
    units: 'mL',
    route: '78421000',
    manufacturer: 'GlaxoSmithKline',
    lot: 'AC52B301',
    expDate: '2027-03-31',
    mvx: 'SKB',
    cvx: '115',
    ndc: '58160-0842-11',
  },
];

export const immunizationMocks: FetchMock[] = [
  ...userMocks,
  ...appointmentMocks,
  { url: 'admin-get-quick-picks', response: { status: 200, output: { quickPicks: mockImmunizationQuickPicks } } },
  { url: 'get-immunization-orders', response: { status: 200, output: { orders: [mockImmunizationOrder] } } },
];

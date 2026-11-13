import { DmeOrderDTO } from 'utils/lib/types/api/dme.types';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';

export const existingQuickPicks: DmeQuickPickData[] = [
  { id: 'qp-1', name: 'Crutches, adult', itemName: 'Crutches, underarm, adjustable' },
  { id: 'qp-2', name: 'Wrist splint', itemName: 'Wrist splint, cock-up' },
];

export const dmeOrder = {
  id: 'device-request-1',
  encounterId: 'encounter-1',
  itemName: 'Crutches, underarm, adjustable',
  diagnoses: [{ code: 'S93.401A', display: 'Sprain of unspecified ligament of right ankle, initial encounter' }],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: 'ordered',
  orderedBy: { practitionerId: 'practitioner-1', name: 'Dr. Jane Smith' },
  orderedAt: '2026-11-12T15:30:00.000Z',
} as unknown as DmeOrderDTO;

import { RadiologyQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { GetRadiologyOrderListZambdaOrder, RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import type { FetchMock } from '../../harness/story';

export const mockRadiologyOrder: GetRadiologyOrderListZambdaOrder = {
  serviceRequestId: 'sr-1',
  appointmentId: 'appt-1',
  cptCode: '71046',
  cptCodeDisplay: 'X-ray of chest, 2 views',
  studyType: '71046 — X-ray of chest, 2 views',
  diagnosis: 'R05.9 — Cough, unspecified',
  clinicalHistory: 'Productive cough for 10 days, low-grade fever.',
  visitDateTime: '2026-11-10T15:00:00.000Z',
  orderAddedDateTime: '2026-11-10T15:20:00.000Z',
  providerName: 'Dr. Olivia Bennett',
  providerId: 'practitioner-1',
  canEditPreliminaryReport: false,
  canEditFinalReport: false,
  status: RadiologyOrderStatus.pending,
  isStat: false,
  consentObtained: true,
};

export const radiologyOrderListMock = (order: GetRadiologyOrderListZambdaOrder): FetchMock => ({
  url: 'radiology-order-list',
  response: {
    status: 200,
    output: { orders: [order], pagination: { currentPageIndex: 0, itemsPerPage: 10, totalItems: 1, totalPages: 1 } },
  },
});

export const mockRadiologyQuickPicks: RadiologyQuickPickData[] = [
  {
    id: 'qp-rad-1',
    name: 'Chest PA/Lateral | X-ray of chest, 2 views',
    cptCode: '71046',
    cptDisplay: 'X-ray of chest, 2 views',
    studyName: 'Chest PA/Lateral',
    clinicalHistory: 'Cough, rule out pneumonia',
  },
  {
    id: 'qp-rad-2',
    name: 'Left ankle 3 views',
    cptCode: '73610',
    cptDisplay: 'X-ray of ankle, 3 or more views',
    studyName: 'Ankle series',
    laterality: 'LT',
    clinicalHistory: 'Inversion injury, lateral malleolus tenderness',
  },
];

export const radiologyQuickPicksMock: FetchMock = {
  url: 'admin-get-quick-picks',
  response: { status: 200, output: { quickPicks: mockRadiologyQuickPicks } },
};

import { ReactElement } from 'react';
import { LabsTableContainer } from 'src/features/external-labs/components/labs-orders/LabsTableContainer';
import { LabOrderListPageDTO, LabsTableColumn } from 'utils/lib/types/data/labs/labs.types';

export const columns: LabsTableColumn[] = [
  'testType',
  'visit',
  'orderAdded',
  'provider',
  'dx',
  'status',
  'detail',
  'actions',
];

export const makeLabOrder = (overrides: Partial<LabOrderListPageDTO>): LabOrderListPageDTO =>
  ({
    serviceRequestId: 'service-request-1',
    testItem: 'CBC With Differential/Platelet',
    testItemCode: '005009',
    fillerLab: 'LabCorp',
    orderAddedDate: '2026-11-12T15:30:00.000Z',
    orderSubmittedDate: undefined,
    orderingPhysician: 'Dr. Jane Smith',
    diagnosesDTO: [{ code: 'R50.9', display: 'Fever, unspecified', isPrimary: true }],
    diagnoses: 'R50.9 Fever, unspecified',
    orderStatus: 'ready',
    isPSC: false,
    isStat: false,
    appointmentId: 'appointment-1',
    visitDate: '2026-11-12T15:00:00.000Z',
    lastResultReceivedDate: '',
    accessionNumbers: [],
    encounterTimezone: 'America/New_York',
    orderNumber: 'ORD-10472',
    abnPdfUrl: undefined,
    orderPdfUrl: undefined,
    location: undefined,
    orderLevelNoteByUser: undefined,
    clinicalInfoNoteByUser: undefined,
    hasCptCodes: true,
    billingType: undefined,
    ...overrides,
  }) as LabOrderListPageDTO;

export const LabsTableHost = ({
  labOrders,
  orderBundleNote,
}: {
  labOrders: LabOrderListPageDTO[];
  orderBundleNote?: string;
}): ReactElement => (
  <LabsTableContainer
    labOrders={labOrders}
    orderBundleName="LabCorp - ORD-10472"
    abnPdfUrl={undefined}
    orderPdfUrl={undefined}
    searchBy={{ searchBy: { field: 'encounterId', value: 'encounter-1' } }}
    columns={columns}
    allowDelete
    allowSubmit
    fetchLabOrders={async () => undefined}
    showDeleteLabOrderDialog={() => undefined}
    handleRejectedAbn={async () => undefined}
    requisitionNumber="ORD-10472"
    orderBundleNote={orderBundleNote}
    onRowClick={() => undefined}
    onDrDrivenRowClick={() => undefined}
  />
);

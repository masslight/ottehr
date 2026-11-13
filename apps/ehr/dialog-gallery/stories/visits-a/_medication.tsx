// Shared setup for the EditableMedicationCard stories (not a story itself).
import { ReactElement } from 'react';
import { EditableMedicationCard } from 'src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationOrderType } from 'src/features/visits/in-person/components/medication-administration/medication-editable-card/fieldsConfig';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import type { FetchMock } from '../../harness/story';
import { ENCOUNTER_ID, PATIENT_ID, PRACTITIONER_ID, visitMocks } from './_fixtures';

export const MEDICATION_ID = 'a1b2c3d4-0000-4000-8000-000000000007';

/** A pending in-house order with everything needed to administer it. */
export const pendingOrder: ExtendedMedicationDataForResponse = {
  id: 'med-order-1',
  status: 'pending',
  medicationName: 'Ibuprofen 600 mg tablet',
  medicationId: MEDICATION_ID,
  patient: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  dose: 600,
  units: 'mg',
  route: '26643006',
  providerId: PRACTITIONER_ID,
  instructions: 'Give with food.',
  lotNumber: 'LOT-48213',
  expDate: '2027-06-30',
  manufacturer: 'Acme Pharma',
  providerCreatedTheOrder: 'Dana Whitfield, MD',
  providerCreatedTheOrderId: PRACTITIONER_ID,
  orderedByProvider: 'Dana Whitfield, MD',
  dateTimeCreated: '2026-11-13T15:10:00.000Z',
  interactions: { drugInteractions: [], allergyInteractions: [] },
};

export const quickPicks = [
  {
    id: 'qp-1',
    name: 'Ibuprofen 600 mg PO',
    medicationName: 'Ibuprofen 600 mg tablet',
    dose: 600,
    units: 'mg',
    route: '26643006',
  },
  {
    id: 'qp-2',
    name: 'Acetaminophen 650 mg PO',
    medicationName: 'Acetaminophen 325 mg tablet',
    dose: 650,
    units: 'mg',
    route: '26643006',
  },
  {
    id: 'qp-3',
    name: 'Ondansetron 4 mg ODT',
    medicationName: 'Ondansetron 4 mg ODT',
    dose: 4,
    units: 'mg',
    route: '26643006',
  },
];

export const medicationMocks = (
  order: ExtendedMedicationDataForResponse,
  roles: string[] = ['Provider']
): FetchMock[] => [
  ...visitMocks(roles),
  { url: 'get-medication-orders', response: { status: 200, output: { orders: [order], cancelledOrders: [] } } },
  {
    url: /\/fhir\/Medication(\?|\/_search|$)/,
    response: {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [
        {
          resource: {
            resourceType: 'Medication',
            id: MEDICATION_ID,
            status: 'active',
            identifier: [
              { system: 'virtual-medication-type', value: 'virtual-medication-inventory' },
              { system: 'virtual-medication-identifier-name-system', value: 'Ibuprofen 600 mg tablet' },
            ],
          },
        },
      ],
    },
  },
  {
    url: 'get-employees',
    response: {
      status: 200,
      output: {
        employees: [
          {
            id: 'user-1',
            profile: `Practitioner/${PRACTITIONER_ID}`,
            name: 'Dana Whitfield',
            firstName: 'Dana',
            lastName: 'Whitfield',
            status: 'Active',
            isProvider: true,
            isCustomerSupport: false,
            roles: ['Provider'],
          },
        ],
      },
    },
  },
  { url: 'quick-picks', response: { status: 200, output: { message: 'ok', quickPicks } } },
];

export const renderCard = (order: ExtendedMedicationDataForResponse, type: MedicationOrderType): ReactElement => (
  <EditableMedicationCard medication={order} type={type} onNavigateToMar={() => undefined} />
);

export const SOURCE =
  'apps/ehr/src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard.tsx';

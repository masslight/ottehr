import { MedicationActions } from 'src/features/visits/in-person/components/medication-administration/mar/MedicationActions';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { defineStory } from '../../harness/story';
import { ENCOUNTER_ID, PATIENT_ID, visitMocks, visitRoute } from './_fixtures';

export const pendingMedication: ExtendedMedicationDataForResponse = {
  id: 'med-order-1',
  status: 'pending',
  medicationName: 'Ibuprofen 600 mg tablet',
  medicationId: 'medication-1',
  patient: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  dose: 600,
  units: 'mg',
  route: '26643006',
  instructions: 'Give with food.',
  providerCreatedTheOrder: 'Dana Whitfield, MD',
  providerCreatedTheOrderId: 'practitioner-1',
  dateTimeCreated: '2026-11-13T15:10:00.000Z',
};

export default defineStory({
  title: 'Delete medication (MAR row)',
  source: 'apps/ehr/src/features/visits/in-person/components/medication-administration/mar/MedicationActions.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'In-person visit → In-house Medications → MAR table → delete icon on a medication row',
  ...visitRoute,
  mocks: [
    ...visitMocks(),
    {
      url: 'get-medication-orders',
      response: { status: 200, output: { orders: [pendingMedication], cancelledOrders: [] } },
    },
  ],
  render: () => <MedicationActions medication={pendingMedication} />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'delete' }));
  },
});

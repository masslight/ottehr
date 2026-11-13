import { RadiologyTable } from 'src/features/radiology/components/RadiologyTable';
import { defineStory } from '../../harness/story';
import { mockRadiologyOrder, radiologyOrderListMock } from './radiology-mocks';

export default defineStory({
  title: 'Delete radiology order',
  source: 'apps/ehr/src/features/radiology/components/useDeleteRadiologyOrderDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'In-person chart → Radiology orders table → trash icon on a row',
  notes:
    'The hook is exercised through its real caller, RadiologyTable (via usePatientRadiologyOrders), with one mocked order.',
  route: '/in-person/appt-1/radiology',
  routePath: '/in-person/:id/radiology',
  mocks: [radiologyOrderListMock(mockRadiologyOrder)],
  render: () => (
    <RadiologyTable
      encounterId="encounter-1"
      columns={['studyType', 'dx', 'ordered', 'stat', 'status', 'actions']}
      allowDelete
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByTestId('radiology-delete-order-sr-1'));
    await screen.findByText('Delete Radiology Order');
  },
});

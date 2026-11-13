import { RadiologyExternalOrderDetailsPage } from 'src/features/radiology/pages/RadiologyExternalOrderDetails';
import { RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { defineStory } from '../../harness/story';
import { mockRadiologyOrder, radiologyOrderListMock } from './radiology-mocks';
import { appointmentMocks, userMocks } from './shared-mocks';

export default defineStory({
  title: 'External radiology order — delete uploaded result',
  source: 'apps/ehr/src/features/radiology/pages/RadiologyExternalOrderDetails.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'In-person chart → Radiology → external order details → Results → trash icon on an uploaded result',
  notes: 'Page rendered with a mocked external order and one mocked uploaded result file.',
  route: '/in-person/appt-1/radiology/sr-1/external-order-details',
  routePath: '/in-person/:id/radiology/:serviceRequestID/external-order-details',
  mocks: [
    ...userMocks,
    ...appointmentMocks,
    radiologyOrderListMock({
      ...mockRadiologyOrder,
      external: true,
      status: RadiologyOrderStatus.reviewed,
      externalResultReviewed: true,
      studyName: 'Chest PA/Lateral',
    }),
    {
      url: 'radiology-list-results',
      response: {
        status: 200,
        output: {
          results: [
            {
              documentReferenceId: 'docref-1',
              title: 'chest-xray-report-2026-11-11.pdf',
              url: 'https://mock.invalid/z3/results/chest-xray-report.pdf',
            },
          ],
        },
      },
    },
  ],
  render: () => <RadiologyExternalOrderDetailsPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'delete result' }, { timeout: 10000 }));
    await screen.findByText('Delete result');
  },
});

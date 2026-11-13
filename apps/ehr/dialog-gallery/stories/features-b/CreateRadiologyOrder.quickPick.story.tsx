import { CreateRadiologyOrder } from 'src/features/radiology/pages/CreateRadiologyOrder';
import { defineStory } from '../../harness/story';
import { radiologyQuickPicksMock } from './radiology-mocks';
import { appointmentMocks, userMocks } from './shared-mocks';

export default defineStory({
  title: 'Radiology order — add to quick picks',
  source: 'apps/ehr/src/features/radiology/pages/CreateRadiologyOrder.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where:
    'In-person chart → Radiology → Order → Quick Picks field → "+ Add or Update Quick Pick" (Administrator / Customer Support only)',
  notes:
    'Order form pre-filled by applying a mocked quick pick first, so the dialog shows its real suggested name (study name | study type | laterality). Signed-in user mocked as Administrator.',
  route: '/in-person/appt-1/radiology/create',
  routePath: '/in-person/:id/radiology/create',
  mocks: [...userMocks, ...appointmentMocks, radiologyQuickPicksMock],
  render: () => <CreateRadiologyOrder />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByLabelText('Quick Picks', undefined, { timeout: 10000 }));
    await user.click(await screen.findByRole('menuitem', { name: /Left ankle 3 views/ }));
    await user.click(await screen.findByLabelText('Quick Picks'));
    await user.click(await screen.findByRole('menuitem', { name: /Add or Update Quick Pick/ }));
    await screen.findByText('Add to Quick Picks');
  },
});

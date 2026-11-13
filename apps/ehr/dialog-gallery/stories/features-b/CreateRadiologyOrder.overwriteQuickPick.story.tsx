import { CreateRadiologyOrder } from 'src/features/radiology/pages/CreateRadiologyOrder';
import { defineStory } from '../../harness/story';
import { radiologyQuickPicksMock } from './radiology-mocks';
import { appointmentMocks, userMocks } from './shared-mocks';

export default defineStory({
  title: 'Radiology order — update existing quick pick?',
  source: 'apps/ehr/src/features/radiology/pages/CreateRadiologyOrder.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where:
    'In-person chart → Radiology → Order → "+ Add or Update Quick Pick" → Save Quick Pick with a name that already exists',
  notes:
    'Stacked on top of the "Add to Quick Picks" dialog, as in the app. Reached by applying a mocked quick pick whose name equals the suggested name, then pressing Save Quick Pick.',
  route: '/in-person/appt-1/radiology/create',
  routePath: '/in-person/:id/radiology/create',
  mocks: [...userMocks, ...appointmentMocks, radiologyQuickPicksMock],
  render: () => <CreateRadiologyOrder />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByLabelText('Quick Picks', undefined, { timeout: 10000 }));
    await user.click(await screen.findByRole('menuitem', { name: /Chest PA\/Lateral/ }));
    await user.click(await screen.findByLabelText('Quick Picks'));
    await user.click(await screen.findByRole('menuitem', { name: /Add or Update Quick Pick/ }));
    await user.click(await screen.findByRole('button', { name: 'Save Quick Pick' }));
    await screen.findByText('Update Existing Quick Pick?');
  },
});

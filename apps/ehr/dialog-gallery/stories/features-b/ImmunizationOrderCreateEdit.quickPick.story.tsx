import { ImmunizationOrderCreateEdit } from 'src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { defineStory } from '../../harness/story';
import { immunizationMocks } from './immunization-mocks';

export default defineStory({
  title: 'Immunization order — save as quick pick',
  source: 'apps/ehr/src/features/immunization/pages/ImmunizationOrderCreateEdit.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where:
    'In-person chart → Immunization → Order Immunization → Quick Picks field → "+ Add or Update Quick Pick" (Administrator only)',
  notes:
    'New-order page; a mocked quick pick is applied first so the dialog shows its real suggested name. Signed-in user mocked as Administrator; the overwrite list comes from mocked quick picks.',
  route: '/in-person/appt-1/immunization/order',
  routePath: '/in-person/:id/immunization/order',
  mocks: immunizationMocks,
  render: () => <ImmunizationOrderCreateEdit />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByLabelText('Quick Picks', undefined, { timeout: 10000 }));
    await user.click(await screen.findByRole('menuitem', { name: /Tdap 0.5 mL IM/ }));
    await user.click(await screen.findByLabelText('Quick Picks'));
    await user.click(await screen.findByRole('menuitem', { name: /Add or Update Quick Pick/ }));
    await screen.findByText('Save as Quick Pick');
  },
});

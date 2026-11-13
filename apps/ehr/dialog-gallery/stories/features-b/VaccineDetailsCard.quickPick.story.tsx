import { VaccineDetailsCard } from 'src/features/immunization/components/VaccineDetailsCard';
import { defineStory } from '../../harness/story';
import { immunizationMocks, mockImmunizationOrder } from './immunization-mocks';

export default defineStory({
  title: 'Immunization administration — save as quick pick',
  source: 'apps/ehr/src/features/immunization/components/VaccineDetailsCard.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where:
    'In-person chart → Immunization → Vaccine details → Quick Picks field → "+ Add or Update Quick Pick" (Administrator only)',
  notes:
    'Signed-in user mocked as Administrator; existing quick picks are mocked so the overwrite list is populated. The suggested name is built by the real hook from the mocked order.',
  route: '/in-person/appt-1/immunization/vaccine-details',
  routePath: '/in-person/:id/immunization/vaccine-details',
  mocks: immunizationMocks,
  render: () => <VaccineDetailsCard order={mockImmunizationOrder} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByLabelText('Quick Picks', undefined, { timeout: 10000 }));
    await user.click(await screen.findByRole('menuitem', { name: /Add or Update Quick Pick/ }));
    await screen.findByText('Save as Quick Pick');
    await screen.findByText('Tdap 0.5 mL IM');
  },
});

import { VaccineDetailsCard } from 'src/features/immunization/components/VaccineDetailsCard';
import { defineStory } from '../../harness/story';
import { immunizationMocks, mockImmunizationOrder } from './immunization-mocks';

export default defineStory({
  title: 'Delete immunization order (vaccine details)',
  source: 'apps/ehr/src/features/immunization/components/VaccineDetailsCard.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'In-person chart → Immunization → Vaccine details → "Delete Order"',
  notes: 'Card rendered with a mocked pending order; opened via the real Delete Order button.',
  route: '/in-person/appt-1/immunization/vaccine-details',
  routePath: '/in-person/:id/immunization/vaccine-details',
  mocks: immunizationMocks,
  render: () => <VaccineDetailsCard order={mockImmunizationOrder} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete Order' }, { timeout: 10000 }));
    await screen.findByText('Delete immunization order');
  },
});

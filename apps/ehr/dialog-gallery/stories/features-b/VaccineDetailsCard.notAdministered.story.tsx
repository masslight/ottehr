import { VaccineDetailsCard } from 'src/features/immunization/components/VaccineDetailsCard';
import { defineStory } from '../../harness/story';
import { immunizationMocks, mockImmunizationOrder } from './immunization-mocks';

export default defineStory({
  title: 'Mark immunization order as not administered (reason required)',
  source: 'apps/ehr/src/features/immunization/components/AdministrationConfirmationDialog.tsx',
  base: 'InPersonModal',
  kind: 'form',
  where:
    'In-person chart → Immunization → Vaccine details → "Not Administered" (same layout for "Partly Administered")',
  notes:
    'Not in the original list (AdministrationConfirmationDialog renders through the InPersonModal wrapper around CustomDialog). Variant with the Reason select; no reason chosen yet, so the confirm button is disabled.',
  route: '/in-person/appt-1/immunization/vaccine-details',
  routePath: '/in-person/:id/immunization/vaccine-details',
  mocks: immunizationMocks,
  render: () => <VaccineDetailsCard order={mockImmunizationOrder} />,
  play: async ({ user, screen }) => {
    await screen.findByDisplayValue('U7421AA', undefined, { timeout: 10000 });
    await user.click(await screen.findByRole('button', { name: 'Not Administered' }));
    await screen.findByText('Order Not Administered');
  },
});

import { InteractionAlertsDialog } from 'src/features/visits/in-person/components/medication-administration/InteractionAlertsDialog';
import { defineStory } from '../../harness/story';
import { interactions } from './InteractionAlertsDialog.story';

export default defineStory({
  title: 'Medication interaction alerts (read-only)',
  source: 'apps/ehr/src/features/visits/in-person/components/medication-administration/InteractionAlertsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'In-person visit → In-house medication dispense / completed order → click the interactions warning',
  render: () => (
    <InteractionAlertsDialog
      medicationName="Ibuprofen 600 mg tablet"
      interactions={{
        drugInteractions: [
          { ...interactions.drugInteractions[0], overrideReason: 'Benefit Outweighs Risk' },
          { ...interactions.drugInteractions[1], overrideReason: 'Will monitor or take precautions' },
        ],
        allergyInteractions: [
          { ...interactions.allergyInteractions[0], overrideReason: 'Patient tolerated previously' },
        ],
      }}
      onCancel={() => undefined}
      readonly
    />
  ),
  notes: 'Same dialog with readonly=true: override reasons are shown as text and there is no Continue button.',
});

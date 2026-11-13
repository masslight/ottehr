import { InteractionAlertsDialog } from 'src/features/visits/in-person/components/medication-administration/InteractionAlertsDialog';
import { MedicationInteractions } from 'utils/lib/types/api/medication-administration.types';
import { defineStory } from '../../harness/story';

export const interactions: MedicationInteractions = {
  drugInteractions: [
    {
      drugs: [{ id: '1001', name: 'Warfarin Sodium 5 mg tablet' }],
      severity: 'high',
      message:
        'Concurrent use of NSAIDs and anticoagulants may increase the risk of bleeding. Monitor for signs of bleeding.',
      source: { reference: 'MedicationRequest/mr-1', display: 'Prescription\nNov 02, 2026\nDr. Alex Morgan' },
    },
    {
      drugs: [{ id: '1002', name: 'Lisinopril 10 mg tablet' }],
      severity: 'moderate',
      message: 'NSAIDs may reduce the antihypertensive effect of ACE inhibitors and worsen renal function.',
      source: { reference: 'MedicationStatement/ms-1', display: 'Patient reported\nOct 18, 2026' },
    },
  ],
  allergyInteractions: [
    { message: 'Patient has a reported allergy to Aspirin (NSAID cross-sensitivity). Reaction: hives.' },
  ],
};

export default defineStory({
  title: 'Medication interaction alerts (override reasons)',
  source: 'apps/ehr/src/features/visits/in-person/components/medication-administration/InteractionAlertsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person visit → In-house medication order → click the interactions warning',
  render: () => (
    <InteractionAlertsDialog
      medicationName="Ibuprofen 600 mg tablet"
      interactions={interactions}
      onCancel={() => undefined}
      onContinue={() => undefined}
    />
  ),
  notes: 'Editable mode with mock drug and allergy interactions; override reasons left empty so Continue is disabled.',
});

import { ExternalRxSuggestions } from 'src/features/visits/shared/components/medical-history-tab/CurrentMedications/ExternalRxSuggestions';
import { defineStory } from '../../harness/story';
import { PATIENT_ID, visitMocks, visitRoute } from './_fixtures';

// In the shipped hook (useExternalMedicationHistory) `isExactMatch` is `lookup.has(id)` and
// `matchedMedication` is `lookup.get(id)`, so a matched-but-inexact row can't currently be produced
// by real data. To photograph the real dialog the lookup cache is seeded with a Map whose `has`
// answers false.
class InexactLookup<K, V> extends Map<K, V> {
  has(): boolean {
    return false;
  }
}

const history = [
  {
    medicationId: 4471,
    name: 'Amoxicillin-Pot Clavulanate',
    strength: '875-125 mg',
    doseForm: 'tablet',
    route: 'oral',
    directions: 'Take 1 tablet by mouth twice daily for 10 days',
    writtenDate: '2026-09-28',
    lastFillDate: '2026-09-29',
    refills: '0',
    quantity: 20,
  },
];

export default defineStory({
  title: 'Confirm inexact medication match',
  source:
    'apps/ehr/src/features/visits/shared/components/medical-history-tab/CurrentMedications/ExternalRxSuggestions.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where:
    'Visit chart → Medical history → Current medications → External Rx panel → click an inexactly matched medication',
  ...visitRoute,
  mocks: visitMocks(),
  setup: ({ queryClient }) => {
    queryClient.setQueryData(['external-medication-history', PATIENT_ID], history);
    queryClient.setQueryData(
      ['external-medication-lookup', '4471'],
      new InexactLookup([
        [
          4471,
          {
            id: 4471,
            routedDoseFormDrugId: 4471,
            name: 'Augmentin',
            rxcui: null,
            ndc: null,
            strength: '875 mg-125 mg tablet',
            isObsolete: false,
          },
        ],
      ])
    );
  },
  render: () => <ExternalRxSuggestions chartedMedications={[]} onSelectMedication={() => undefined} />,
  play: async ({ user, screen, waitFor }) => {
    await user.click(await waitFor(() => screen.getByText(/inexact match/), { timeout: 10000 }));
  },
  notes:
    'FORCED STATE: with the current useExternalMedicationHistory logic a medication is either matched exactly or not matched at all, so this dialog appears unreachable in the product. The story seeds the react-query cache (history + a lookup Map whose has() returns false) to make the real component open it.',
});

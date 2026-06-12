import { AISuggestionNotesInput } from 'utils';

export interface TestScenario {
  label: string;
  input: AISuggestionNotesInput;
  expectContains: string[];
  expectEmpty?: true;
}

const HPI_MISSING_ONSET_DURATION: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient presents with sore throat. Pain aggravated by swallowing. Ibuprofen provides some relief. Associated with mild fever and headache.',
};

const MINIMAL_HPI: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient has a cough.',
};

const HPI_MISSING_SEVERITY_RELIEVING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient twisted right ankle 3 days ago playing soccer. Pain is located over the lateral aspect of the right ankle and has been present since the injury. Pain is sharp and constant. Aggravated by weight-bearing and ambulation.',
};

const HPI_MISSING_ONSET_AGGRAVATING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient presents with a throbbing headache located behind both eyes. Pain is 7/10 in severity. No nausea or vomiting. No photophobia or phonophobia.',
};

const HPI_MISSING_CHARACTERISTIC_AGGRAVATING_RELIEVING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient started having abdominal pain yesterday. Pain is 5/10. Located in the right lower quadrant. Associated with nausea and one episode of vomiting.',
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'HPI missing onset and duration → AI should flag those elements',
    input: HPI_MISSING_ONSET_DURATION,
    expectContains: ['Onset', 'Duration'],
  },
  {
    label: 'Minimal HPI (single sentence) → AI should flag most OLDCARTS elements',
    input: MINIMAL_HPI,
    expectContains: ['Onset', 'Duration', 'Severity'],
  },
  {
    label: 'Ankle injury HPI missing severity and relieving factors → AI should flag those',
    input: HPI_MISSING_SEVERITY_RELIEVING,
    expectContains: ['Severity', 'Relieving'],
  },
  {
    label: 'Headache HPI missing onset, duration, and aggravating factors → AI should flag those',
    input: HPI_MISSING_ONSET_AGGRAVATING,
    expectContains: ['Onset', 'Duration', 'Aggravating'],
  },
  {
    label: 'Abdominal pain HPI missing characteristic, aggravating, and relieving → AI should flag those',
    input: HPI_MISSING_CHARACTERISTIC_AGGRAVATING_RELIEVING,
    expectContains: ['Aggravating', 'Relieving', 'Characteristic'],
  },
];

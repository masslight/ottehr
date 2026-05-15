import { AISuggestionNotesInput } from 'utils';

export interface TestScenario {
  label: string;
  input: AISuggestionNotesInput;
  /** At least one suggestion must contain one of these substrings (case-insensitive). Ignored when expectEmpty is true. */
  expectContains: string[];
  /** When true, the test passes only if suggestions is empty. */
  expectEmpty?: true;
}

// Procedure: wound closure with all required details present.
const COMPLETE_PROCEDURE: AISuggestionNotesInput = {
  type: 'procedure',
  details: {
    procedureDetails:
      'Wound closure performed on a 3 cm laceration on the right forearm. Closed with 4-0 nylon sutures, 6 interrupted stitches. Patient tolerated procedure well.',
  },
};

// Procedure: missing closure material and count.
const INCOMPLETE_PROCEDURE: AISuggestionNotesInput = {
  type: 'procedure',
  details: {
    procedureDetails: 'Length: Complexity: Type of Suture: Material Used:',
  },
};

// HPI: onset and duration not documented.
const HPI_MISSING_ONSET_DURATION: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient presents with sore throat. Pain aggravated by swallowing. Ibuprofen provides some relief. Associated with mild fever and headache.',
};

// HPI: only a single vague sentence — most elements missing.
const MINIMAL_HPI: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient has a cough.',
};

// HPI: ankle injury with onset/location/characteristic/aggravating documented but missing severity and relieving factors.
const HPI_MISSING_SEVERITY_RELIEVING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient twisted right ankle 3 days ago playing soccer. Pain is located over the lateral aspect of the right ankle and has been present since the injury. Pain is sharp and constant. Aggravated by weight-bearing and ambulation.',
};

// HPI: headache with location/characteristic/severity/associated symptoms but missing onset, duration, and aggravating factors.
const HPI_MISSING_ONSET_AGGRAVATING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient presents with a throbbing headache located behind both eyes. Pain is 7/10 in severity. No nausea or vomiting. No photophobia or phonophobia.',
};

// HPI: abdominal pain with onset/severity/location/associated symptoms but missing characteristic, aggravating, and relieving factors.
const HPI_MISSING_CHARACTERISTIC_AGGRAVATING_RELIEVING: AISuggestionNotesInput = {
  type: 'missing-hpi',
  hpi: 'Patient started having abdominal pain yesterday. Pain is 5/10. Located in the right lower quadrant. Associated with nausea and one episode of vomiting.',
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'Complete procedure note → AI should confirm details are included',
    input: COMPLETE_PROCEDURE,
    expectContains: ['Procedure details are included'],
  },
  {
    label: 'Incomplete procedure note → AI should request closure type / material / count',
    input: INCOMPLETE_PROCEDURE,
    expectContains: ['Please specify closure type'],
  },
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

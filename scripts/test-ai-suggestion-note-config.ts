import { AISuggestionNotesInput } from 'utils';

export interface TestScenario {
  label: string;
  input: AISuggestionNotesInput;
  /** At least one suggestion must contain one of these substrings (case-insensitive). */
  expectContains: string[];
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
];

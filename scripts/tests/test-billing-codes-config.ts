import { ProcedureDetail } from 'utils';

export interface ScenarioChecks {
  /** At least one of these CPT codes must appear in the suggestions. */
  expectAnyCodes: string[];
  expected: string;
}

export interface TestScenario {
  label: string;
  input: ProcedureDetail;
  checks: ScenarioChecks;
}

// Simple laceration repair, extremity, 2.5 cm, nylon sutures.
const LACERATION_REPAIR: ProcedureDetail = {
  procedureType: 'Wound closure',
  diagnoses: [{ code: 'S51.812A', display: 'Open bite of right forearm, initial encounter', isPrimary: true }],
  bodySite: 'right forearm',
  bodySide: 'right',
  technique: ['simple interrupted'],
  suppliesUsed: '4-0 nylon sutures',
  procedureDetails:
    '2.5 cm laceration on the right forearm, closed with 4-0 nylon sutures using 5 simple interrupted stitches. Wound edges well-approximated. Patient tolerated well.',
};

// Short leg splint for right ankle sprain.
const ANKLE_SPLINT: ProcedureDetail = {
  procedureType: 'Splinting',
  diagnoses: [
    { code: 'S93.401A', display: 'Sprain of unspecified ligament of right ankle, initial encounter', isPrimary: true },
  ],
  bodySite: 'right ankle',
  bodySide: 'right',
  technique: ['posterior splint'],
  suppliesUsed: 'fiberglass splinting material, stockinette, webril',
  procedureDetails:
    'Short leg posterior splint applied to right ankle for ankle sprain. Neurovascular status intact distally post-application.',
};

// Nebulizer treatment for acute asthma exacerbation.
const NEBULIZER_TREATMENT: ProcedureDetail = {
  procedureType: 'Nebulizer Treatment',
  diagnoses: [{ code: 'J45.31', display: 'Moderate persistent asthma with (acute) exacerbation', isPrimary: true }],
  medicationUsed: 'albuterol 2.5 mg in 3 mL normal saline',
  procedureDetails:
    'Albuterol nebulizer treatment administered for acute asthma exacerbation. Patient completed treatment without adverse effects. Breath sounds improved post-treatment.',
  timeSpent: '15 minutes',
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'Simple laceration repair, right forearm, 2.5 cm, nylon sutures → expect 12001 or 12002',
    input: LACERATION_REPAIR,
    checks: {
      expectAnyCodes: ['12001', '12002'],
      expected: '12001 or 12002 (simple repair, trunk/extremities ≤7.5 cm)',
    },
  },
  {
    label: 'Short leg posterior splint, right ankle → expect 29515 or 29125',
    input: ANKLE_SPLINT,
    checks: {
      expectAnyCodes: ['29515', '29125', '29126'],
      expected: '29515 (short leg splint) or 29125/29126 (static/dynamic short arm splint)',
    },
  },
  {
    label: 'Nebulizer treatment, albuterol → expect 94640',
    input: NEBULIZER_TREATMENT,
    checks: {
      expectAnyCodes: ['94640'],
      expected: '94640 (nebulizer treatment)',
    },
  },
];

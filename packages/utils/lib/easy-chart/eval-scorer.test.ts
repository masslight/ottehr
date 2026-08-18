// The scorer must catch every failure class the twenty synthetic cases exist to detect. These
// fixtures are hand-built action lists — a clean plan and a deliberately broken one — so the checks
// run in CI without a model or a live environment.

import { describe, expect, it } from 'vitest';
import { ChartPlanResponse, PlannedAction } from './api';
import { EvalRuleId, scorePlan, scoreProvenance } from './eval-scorer';
import { quoteOccursInNarrative } from './provenance';

const envelope = (actions: PlannedAction[], rejected: ChartPlanResponse['rejected'] = []): ChartPlanResponse => ({
  actions,
  rejected,
  usage: [],
  escalation: { attempts: 1, escalated: false, failures: [] },
  triggers: [],
});

// Case 02 from the synthetic corpus: strep pharyngitis, established child, follow-up stated.
const CLEAN_PLAN: PlannedAction[] = [
  { kind: 'set-vital', field: 'vital-temperature', display: '102 F', value: 102, unit: 'F' },
  { kind: 'add-exam-finding', display: 'Tonsils enlarged and erythematous with white exudate' },
  { kind: 'add-ros-finding', display: 'Denies cough', finding: 'denies' },
  { kind: 'add-diagnosis', display: 'Streptococcal pharyngitis', code: 'J02.0', isPrimary: true },
  { kind: 'add-medication', display: 'Amoxicillin', strength: '50 mg/kg' },
  { kind: 'set-em-code', code: '99214', display: 'Established patient, moderate' },
  { kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up with pediatrician.', followUpInDays: 3 },
];

const rules = (response: ChartPlanResponse, expectations = {}): EvalRuleId[] =>
  scorePlan(response, expectations).violations.map((v) => v.rule);

describe('scorePlan', () => {
  it('passes a clean plan', () => {
    expect(rules(envelope(CLEAN_PLAN), { patientStatus: 'established', expectsDisposition: true })).toEqual([]);
  });

  it('counts what it scored', () => {
    expect(scorePlan(envelope(CLEAN_PLAN)).stats).toEqual({ actions: 7, rejected: 0, diagnoses: 1, vitals: 1 });
  });

  it('catches a missing or malformed diagnosis code', () => {
    expect(rules(envelope([{ kind: 'add-diagnosis', display: 'Strep throat', isPrimary: true }]))).toContain(
      'diagnosis-code-missing'
    );
    expect(
      rules(envelope([{ kind: 'add-diagnosis', display: 'Strep throat', code: 'NOPE', isPrimary: true }]))
    ).toContain('diagnosis-code-malformed');
  });

  it('catches a duplicated diagnosis and a missing or doubled primary', () => {
    const duplicated: PlannedAction[] = [
      { kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true },
      { kind: 'add-diagnosis', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true },
    ];
    const found = rules(envelope(duplicated));
    expect(found).toContain('diagnosis-duplicated');
    expect(found).toContain('primary-diagnosis-multiple');

    expect(rules(envelope([{ kind: 'add-diagnosis', display: 'Strep', code: 'J02.0' }]))).toContain(
      'primary-diagnosis-missing'
    );
  });

  // Case 01: "no numbness or tingling", "straight leg raise is negative bilaterally".
  it('catches a negated finding charted as an abnormality', () => {
    expect(rules(envelope([{ kind: 'add-exam-finding', display: 'No numbness' }]))).toContain(
      'negated-finding-charted'
    );
    expect(
      rules(envelope([{ kind: 'add-exam-finding', display: 'Straight leg raise negative bilaterally' }]))
    ).toContain('negated-finding-charted');
    expect(
      rules(envelope([{ kind: 'add-exam-finding', display: 'Lumbar paraspinal tenderness' }]), {
        negatedFindings: ['numbness'],
      })
    ).not.toContain('negated-finding-charted');
  });

  it('catches a ROS finding with no reports/denies polarity', () => {
    expect(rules(envelope([{ kind: 'add-ros-finding', display: 'headache' }]))).toContain('ros-polarity-missing');
  });

  // `1.73 m` passed through untouched charts a 1.73 cm patient.
  it('catches a vital charted in a unit the write path does not handle', () => {
    expect(
      rules(envelope([{ kind: 'set-vital', field: 'vital-height', display: '1.73 m', value: 1.73, unit: 'm' }]))
    ).toContain('vital-unit-unconverted');
    expect(rules(envelope([{ kind: 'set-vital', field: 'vital-weight', display: '80 kg' }]))).toContain(
      'vital-unit-unconverted'
    );
    expect(
      rules(envelope([{ kind: 'set-vital', field: 'vital-blood-pressure', display: '122/78', systolic: 122 }]))
    ).toContain('vital-unit-unconverted');
  });

  // `5.8 inches` is decimal feet written as inches. Charting it is the failure.
  it('catches an implausible height that was charted instead of questioned', () => {
    expect(
      rules(envelope([{ kind: 'set-vital', field: 'vital-height', display: '5.8 inches', value: 5.8, unit: 'in' }]))
    ).toContain('vital-implausible-charted');
  });

  it('catches a missing, malformed or wrong-family E&M code', () => {
    expect(rules(envelope([{ kind: 'add-diagnosis', display: 'X', code: 'J02.0', isPrimary: true }]))).toContain(
      'em-code-missing'
    );
    expect(rules(envelope([{ kind: 'set-em-code', code: 'E&M4' }]))).toContain('em-code-malformed');
    expect(rules(envelope([{ kind: 'set-em-code', code: '99214' }]), { patientStatus: 'new' })).toContain(
      'em-code-wrong-family'
    );
    expect(rules(envelope([{ kind: 'set-em-code', code: '99204' }]), { patientStatus: 'new' })).not.toContain(
      'em-code-wrong-family'
    );
  });

  it('accepts a HCPCS J-code alongside an administration CPT', () => {
    const found = rules(
      envelope([
        { kind: 'add-cpt', code: '96372', display: 'Therapeutic injection, SC/IM' },
        { kind: 'add-cpt', code: 'J1885', display: 'Ketorolac, per 15 mg' },
      ])
    );
    expect(found).not.toContain('cpt-code-malformed');
    expect(rules(envelope([{ kind: 'add-cpt', code: 'ABC' }]))).toContain('cpt-code-malformed');
  });

  it('catches a stated follow-up that produced no disposition', () => {
    expect(rules(envelope([{ kind: 'set-em-code', code: '99213' }]), { expectsDisposition: true })).toContain(
      'disposition-missing'
    );
  });

  // A rejection with a blank reason is a silent no-op wearing a hat.
  it('catches a skipped step with no reason', () => {
    expect(rules(envelope(CLEAN_PLAN, [{ kind: 'add-medication', reason: '' }]))).toContain('rejection-without-reason');
  });
});

describe('scoreProvenance', () => {
  const narrative = 'Rapid strep antigen was positive. Will start amoxicillin 50 mg per kilogram once daily.';

  it('accepts a verified quote and an inferred item with none', () => {
    expect(
      scoreProvenance(
        [
          { kind: 'add-diagnosis', display: 'Strep', sourceText: 'Rapid strep antigen was positive' },
          { kind: 'set-em-code', code: '99214' },
        ],
        narrative,
        quoteOccursInNarrative
      )
    ).toEqual([]);
  });

  it('catches a fabricated citation', () => {
    const found = scoreProvenance(
      [{ kind: 'add-diagnosis', display: 'Strep', sourceText: 'the throat culture grew group A strep' }],
      narrative,
      quoteOccursInNarrative
    );
    expect(found.map((v) => v.rule)).toEqual(['provenance-quote-unverified']);
  });
});

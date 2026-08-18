import { describe, expect, it } from 'vitest';
import { computeSignBlockers, SignBlockerInput, signBlockerMessages } from './sign-blockers';

const SIGNABLE: SignBlockerInput = {
  hasPrimaryDiagnosis: true,
  medicalDecision: 'Consistent with acute otitis media, right ear. Started amoxicillin.',
  hasEmCode: true,
  hpi: '7y M p/w right otalgia x1 day.',
  patientInfoConfirmed: true,
  mdmRequired: true,
};

const ids = (input: SignBlockerInput): string[] => computeSignBlockers(input).map((b) => b.id);

describe('computeSignBlockers', () => {
  it('reports nothing for a complete note', () => {
    expect(computeSignBlockers(SIGNABLE)).toEqual([]);
  });

  // The four rules the Easy Chart copy was MISSING, so a clean panel there did not mean a signable
  // note: HPI, both accident fields, and patient verification.
  it('reports the four rules the duplicated copy was missing', () => {
    expect(ids({ ...SIGNABLE, hpi: '   ' })).toContain('no-hpi');
    expect(ids({ ...SIGNABLE, patientInfoConfirmed: false })).toContain('patient-info-unconfirmed');
    expect(ids({ ...SIGNABLE, accident: { type: ['WC'] } })).toContain('accident-no-date');
    expect(ids({ ...SIGNABLE, accident: { type: ['AA'], date: '2026-01-02' } })).toContain('accident-no-state');
  });

  it('does not demand an accident state for a non-auto accident', () => {
    expect(ids({ ...SIGNABLE, accident: { type: ['WC'], date: '2026-01-02' } })).toEqual([]);
  });

  it('honours the practice config when MDM is optional', () => {
    expect(ids({ ...SIGNABLE, medicalDecision: '', mdmRequired: true })).toContain('no-mdm');
    expect(ids({ ...SIGNABLE, medicalDecision: '', mdmRequired: false })).not.toContain('no-mdm');
  });

  it('reports the core chart-content rules', () => {
    expect(ids({ ...SIGNABLE, hasPrimaryDiagnosis: false })).toContain('no-primary-dx');
    expect(ids({ ...SIGNABLE, hasEmCode: false })).toContain('no-em');
  });

  // Deliberate behaviour change, documented in the module: the sign button used to test the
  // truthiness of the ARRAY, and an empty array is truthy in JS — so `resultsPending: []` blocked
  // signing when nothing was pending.
  it('does not block on an empty pending-results array', () => {
    expect(ids({ ...SIGNABLE, inHouseLabResults: { resultsPending: [] } as never })).toEqual([]);
    expect(ids({ ...SIGNABLE, inHouseLabResults: { resultsPending: ['CBC'] } as never })).toContain(
      'inhouse-lab-results-pending'
    );
  });

  it('reports one blocker per pending reflex test', () => {
    const blockers = computeSignBlockers({
      ...SIGNABLE,
      inHouseLabResults: { reflexTestsPending: ['Strep culture', 'Flu B'] } as never,
    });
    expect(blockers.map((b) => b.id)).toEqual(['reflex-test-pending-Strep culture', 'reflex-test-pending-Flu B']);
  });
});

describe('signBlockerMessages', () => {
  // The sign button's existing wording: the missing-data group collapses to ONE line, verification
  // and labs get their own.
  it('reproduces the sign button wording', () => {
    const blockers = computeSignBlockers({
      ...SIGNABLE,
      hasPrimaryDiagnosis: false,
      hasEmCode: false,
      patientInfoConfirmed: false,
      inHouseLabResults: { resultsPending: ['CBC'], reflexTestsPending: ['Strep culture'] } as never,
    });
    expect(signBlockerMessages(blockers)).toEqual([
      'You need to fill in the missing data',
      'You need to confirm patient information',
      'In-House lab results pending',
      'In-House lab results have triggered a reflex test for Strep culture',
    ]);
  });

  it('says nothing for a signable note', () => {
    expect(signBlockerMessages(computeSignBlockers(SIGNABLE))).toEqual([]);
  });
});

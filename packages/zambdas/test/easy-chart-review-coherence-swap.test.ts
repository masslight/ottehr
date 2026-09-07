import { PlannedAction } from 'utils/lib/easy-chart/api';
import { buildPrompt as buildSurfacePrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { capabilitiesForSurface } from 'utils/lib/easy-chart/registry';
import { describe, expect, it } from 'vitest';
import { carrySwapPrimaryFromChartState } from '../src/ehr/easy-chart-shared/swap-primary';

// The prompt is built per SURFACE now, so the pins take the review surface explicitly.
const buildPrompt = (narrative: string, tail: Partial<PromptTailInput> = {}): string =>
  buildSurfacePrompt('review', { narrative, ...tail });

// Check 9 ("coherence") regression pins for the contradicted-diagnosis SWAP mandate. Live failure
// (reproduced twice, synthetic template data): the chart coded acute vaginitis (N76.0) while the
// narrative described a candidal yeast infection, and the review emitted a BARE remove-diagnosis —
// leaving the chart with zero diagnoses — instead of the two-intent swap to B37.3 that carries
// primary status. The fix is prompt-side (the swap is mandatory when the note supports a specific
// alternative; bare removal only when it supports none, and never into a dx-less chart), so these
// tests pin the prompt text and the caching structure, plus the server half of the primary
// carry-over for a coherence-originated swap. All narratives/chart states below are synthetic.
describe('easy-chart-review coherence dx swap', () => {
  describe('check-9 prompt mandate', () => {
    const prompt = buildPrompt('Synthetic narrative.');
    const check9 = prompt.slice(prompt.indexOf('9) "coherence"'), prompt.indexOf('10) "dropped-commitment"'));

    // The wording is the current prompt's; the RULES these pin are the ones the live failure produced,
    // so a refactor may rephrase them but must not drop them.
    it('mandates the two-action swap when the note supports an alternative diagnosis', () => {
      expect(check9).toMatch(/two-action swap as check 2/);
      expect(check9).toMatch(/never a bare removal/i);
    });

    it('claims the swap for check 9 itself rather than deferring it to check 2', () => {
      expect(check9).toMatch(/The swap belongs to THIS check/);
      expect(check9).toMatch(/do not defer it to check 2/i);
    });

    it('refuses a removal that would leave the chart with no diagnosis', () => {
      expect(check9).toMatch(/zero diagnoses/i);
      expect(check9).toMatch(/no diagnosis at all/i);
    });
  });

  // The planner's E&M level tiebreak is a policy for AUTHORING a code and must not reach the audit.
  // Review's check 4 exists to catch an E&M that came out too low; telling it to round down when torn
  // leaves it arguing with itself, and the corpus says which side wins — 15 of the 16 E&M misses on the
  // cases with a known patient status were under-codes. It lived in `set-em-code`'s registry promptDoc,
  // which all three surfaces share, so this is easy to reintroduce by accident.
  describe('the level tiebreak is scoped to the surfaces that author a code', () => {
    const collapse = (surface: 'plan' | 'coding' | 'review'): string =>
      buildSurfacePrompt(surface, { narrative: 'Synthetic narrative.' }).replace(/\s+/g, ' ');

    it('is present on plan and coding', () => {
      expect(collapse('plan')).toMatch(/choose the LOWER/);
      expect(collapse('coding')).toMatch(/choose the LOWER/);
    });

    it('is absent from review', () => {
      expect(collapse('review')).not.toMatch(/choose the LOWER/);
    });

    it('never carries a developer note about our own eval scores into any prompt', () => {
      // `promptDoc` is prompt text. A note documenting the tiebreak trade-off — with our eval counts and
      // a restatement of the rule we had decided NOT to use — spent one run inside that template literal.
      for (const surface of ['plan', 'coding', 'review'] as const) {
        expect(collapse(surface)).not.toMatch(/MEASURED TRADE-OFF|billing-policy call|reproduced across paired/);
      }
    });
  });

  describe('prompt static-prefix caching structure', () => {
    const marker = '═══ END OF FIXED INSTRUCTIONS';
    const prefixOf = (p: string): string => {
      const i = p.indexOf(marker);
      expect(i).toBeGreaterThan(0);
      return p.slice(0, i);
    };

    it('the fixed-instruction prefix is byte-identical across per-visit inputs', () => {
      const a = buildPrompt('Patient reports vaginal itching and thick white discharge.');
      const b = buildPrompt('Different synthetic narrative about an earache.', {
        chartStateSummary: 'Diagnoses: Acute vaginitis (N76.0) (primary)',
        patientLine: 'Age: 30 years, Sex: female',
        patientStatus: 'established',
        mustAddress: 'The dictation states a follow-up plan ("follow up in a week") and none is charted.',
      });
      expect(prefixOf(a)).toBe(prefixOf(b));
    });

    it('every per-visit block header renders after the fixed prefix', () => {
      const p = buildPrompt('Synthetic narrative.', {
        chartStateSummary: 'Diagnoses: Acute vaginitis (N76.0) (primary)',
        patientLine: 'Age: 30 years, Sex: female',
        patientStatus: 'new',
        mustAddress: 'The dictation states a follow-up plan ("follow up in a week") and none is charted.',
      });
      const markerIdx = p.indexOf(marker);
      // Every block whose content varies per visit — the forced disposition instruction included, since
      // it is per-call and would otherwise poison the cacheable prefix.
      for (const header of [
        'PATIENT (authoritative',
        // The parenthetical, not a bare "PATIENT STATUS:" — the fixed prefix's em-level rule refers to
        // "the PATIENT STATUS line below", so the bare string matches inside the cacheable prefix and the
        // assertion would pass on the wrong occurrence. This form renders only in the per-visit block.
        'PATIENT STATUS (authoritative',
        'ALREADY ON THE CHART:',
        'MUST ADDRESS THIS CALL:',
      ]) {
        expect(p.indexOf(header)).toBeGreaterThan(markerIdx);
      }
    });
  });

  describe('carrySwapPrimaryFromChartState on a coherence-originated swap', () => {
    it('carries primary from chartState onto the add when the model omits isPrimary', () => {
      const actions: PlannedAction[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Acute vaginitis (N76.0) (primary); Headache (R51.9)');
      expect(actions[1].isPrimary).toBe(true);
    });

    it('marks the add secondary when the removed dx was not primary', () => {
      const actions: PlannedAction[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Headache (R51.9) (primary); Acute vaginitis (N76.0)');
      expect(actions[1].isPrimary).toBe(false);
    });

    it('never overrides a model-stated isPrimary', () => {
      const actions: PlannedAction[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3', isPrimary: true },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Headache (R51.9) (primary); Acute vaginitis (N76.0)');
      expect(actions[1].isPrimary).toBe(true);
    });
  });
});

// The review surface must carry NO planner-only guidance. `promptDoc` is shared by every surface
// offering an action, which made this leak repeatedly and expensively:
//   - the E&M level tiebreak told the audit to round down while check 4 asks it to round up (+4 exact
//     E&M once removed);
//   - `edit-note-text` told it to "ALWAYS emit … for HPI AND MDM on EVERY visit", so it proposed
//     rewriting both on every call — 19-28 confirmation cards per 40 cases against dabrams' 0;
//   - `add-cpt` and `provider-note` told it to emit `add-medication`, which is not in its vocabulary;
//   - the tail rendered the practice's template list and a rule about `apply-template`, which review
//     cannot emit at all.
// Anything surface-specific belongs in that surface's RULES or in `authoringDoc`, never in `promptDoc`.
describe('the review prompt carries no planner-only guidance', () => {
  const review = buildSurfacePrompt('review', {
    narrative: 'Synthetic narrative.',
    templateTitles: ['Sinusitis', 'Otitis Media'],
    chartStateSummary: 'Diagnoses: Acute vaginitis (N76.0) (primary)',
  }).replace(/\s+/g, ' ');

  it.each([
    ['the template list', /AVAILABLE TEMPLATES/],
    ['apply-template', /apply-template/],
    ['add-medication', /add-medication/],
    ['add-patient-instruction', /add-patient-instruction/],
    ['the "always rewrite HPI and MDM" instruction', /ALWAYS emit edit-note-text/],
    ['the note-authoring VOICE block', /VOICE for newText/],
    ['the injection/HCPCS billing table', /INJECTION ADMINISTRATION BILLING|J1885/],
  ])('does not mention %s', (_label, pattern) => {
    expect(review).not.toMatch(pattern);
  });

  it('still describes every action the review surface actually offers', () => {
    for (const kind of capabilitiesForSurface('review')) {
      expect(review).toContain(kind);
    }
  });

  it('keeps that guidance on the surfaces that author a note', () => {
    const plan = buildSurfacePrompt('plan', { narrative: 'Synthetic narrative.' }).replace(/\s+/g, ' ');
    expect(plan).toMatch(/ALWAYS emit edit-note-text/);
    expect(plan).toMatch(/VOICE for newText/);
    expect(plan).toMatch(/INJECTION ADMINISTRATION BILLING/);
    expect(plan).toMatch(/add-medication/);
  });
});

// The checks are where review's value lives, and every one of them had been compressed to roughly half
// the dabrams wording — losing the operative detail, not padding. These pin the specifics that were
// missing, each of which maps to a metric: the level rule to E&M, the dispositionType list and interval
// conversion to disposition coverage, the procedure list to CPT.
describe('the ten checks carry their operative detail', () => {
  const review = buildSurfacePrompt('review', { narrative: 'Synthetic narrative.' }).replace(/\s+/g, ' ');

  it('check 4 names the rule that raises a level, not just the family', () => {
    expect(review).toMatch(/prescription drug management = moderate risk/);
    expect(review).toMatch(/99203 new \/ 99213 established/);
    expect(review).toMatch(/99204 \/ 99214/);
  });

  // The level rule cuts both ways or it is not a rule. A first attempt at check 4 added "an E&M left a
  // level below what the note supports is under-billing, and correcting it is this check's whole
  // purpose" plus extra level-4 triggers; the model read that as a standing order to escalate and
  // collapsed onto 99204 — 29/40 exact while going 0-for-5 on the cases whose gold is NOT level 4,
  // against the dabrams run's 4-of-5. Gold is level 4 in 35 of 40 cases, so the headline rewarded it.
  it('check 4 does not bias the level upward', () => {
    expect(review).toMatch(/JUDGE THE LEVEL, do not default to one/);
    expect(review).toMatch(/Level 3 is right for a straightforward, low-complexity visit/);
    expect(review).toMatch(/Emit nothing here when the charted code is already right/);
    expect(review).not.toMatch(/under-billing/);
  });

  it('check 7 enumerates the disposition types and the interval conversion', () => {
    for (const type of ['"pcp"', '"specialty"', '"ed"', '"another"', '"ip"']) expect(review).toContain(type);
    expect(review).toMatch(/"in 1 week" → 7/);
  });

  it('check 8 enumerates what is actually billable', () => {
    expect(review).toMatch(/cerumen removal/i);
    expect(review).toMatch(/rapid strep/i);
  });

  it('checks 2 and 9 carry worked code swaps', () => {
    expect(review).toMatch(/H66\.003/);
    expect(review).toMatch(/H66\.006/);
    expect(review).toMatch(/N76\.0/);
    expect(review).toMatch(/B37\.3/);
  });

  it('check 3 keeps the quote-do-not-infer limits', () => {
    expect(review).toMatch(/no tragus tenderness/);
    expect(review).toMatch(/Denies ear pain/);
  });
});

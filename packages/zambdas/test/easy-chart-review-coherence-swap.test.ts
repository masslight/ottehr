import { PlannedAction } from 'utils/lib/easy-chart/api';
import { buildPrompt as buildSurfacePrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { capabilitiesForSurface } from 'utils/lib/easy-chart/registry';
import { describe, expect, it } from 'vitest';
import { carrySwapPrimaryFromChartState } from '../src/ehr/easy-chart-review/helpers';

const buildPrompt = (narrative: string, tail: Partial<PromptTailInput> = {}): string =>
  buildSurfacePrompt('review', { narrative, ...tail });

// A coherence removal must come with the diagnosis the note supports, never leave the chart with none.
describe('easy-chart-review coherence dx swap', () => {
  describe('coherence check prompt mandate', () => {
    const prompt = buildPrompt('Synthetic narrative.');
    const check = prompt.slice(prompt.indexOf('8) "coherence"'), prompt.indexOf('9) "dropped-commitment"'));

    it('finds the check', () => {
      expect(check.length).toBeGreaterThan(0);
    });

    it('mandates the two-action swap when the note supports an alternative diagnosis', () => {
      expect(check).toMatch(/two-action swap as check 2/);
      expect(check).toMatch(/never a bare removal/i);
    });

    it('claims the swap for this check rather than deferring it to check 2', () => {
      expect(check).toMatch(/The swap belongs to THIS check/);
      expect(check).toMatch(/do not defer it to check 2/i);
    });

    it('refuses a removal that would leave the chart with no diagnosis', () => {
      expect(check).toMatch(/zero diagnoses/i);
      expect(check).toMatch(/no diagnosis at all/i);
    });
  });

  // Review's E&M check exists to catch under-coding, so it must not be told to round down.
  describe('the level tiebreak is scoped to the plan surface', () => {
    const collapse = (surface: 'plan' | 'review'): string =>
      buildSurfacePrompt(surface, { narrative: 'Synthetic narrative.' }).replace(/\s+/g, ' ');

    it('is present on plan', () => {
      expect(collapse('plan')).toMatch(/choose the LOWER/);
    });

    it('is absent from review', () => {
      expect(collapse('review')).not.toMatch(/choose the LOWER/);
    });

    it('never carries a developer note about our own eval scores into any prompt', () => {
      for (const surface of ['plan', 'review'] as const) {
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
      for (const header of [
        'PATIENT (authoritative',
        // Not a bare "PATIENT STATUS:", which the fixed prefix also mentions.
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

// Surface-specific text belongs in the surface's RULES or in `authoringDoc`, not in the shared `promptDoc`.
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
    ['the "record both ROS directions" authoring rule', /RECORD BOTH DIRECTIONS/],
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
    expect(plan).toMatch(/add-medication/);
    expect(plan).toMatch(/RECORD BOTH DIRECTIONS/);
  });
});

describe('the review checks carry their operative detail', () => {
  const review = buildSurfacePrompt('review', { narrative: 'Synthetic narrative.' }).replace(/\s+/g, ' ');

  it('check 4 names the rule that raises a level, not just the family', () => {
    expect(review).toMatch(/prescription drug management = moderate risk/);
    expect(review).toMatch(/99203 new \/ 99213 established/);
    expect(review).toMatch(/99204 \/ 99214/);
  });

  // Framing a low level as under-billing pushes the model to code every visit as level 4.
  it('check 4 does not bias the level upward', () => {
    expect(review).toMatch(/JUDGE THE LEVEL, do not default to one/);
    expect(review).toMatch(/Level 3 is right for a straightforward, low-complexity visit/);
    expect(review).toMatch(/Emit nothing here when the charted code is already right/);
    expect(review).not.toMatch(/under-billing/);
  });

  it('check 7 enumerates the disposition types and the interval conversion', () => {
    for (const type of ['"pcp-no-type"', '"specialty"', '"ed"', '"another"']) expect(review).toContain(type);
    // types the Disposition card has no tab for
    for (const type of ['"pcp"', '"ip"']) expect(review).not.toContain(type);
    expect(review).toMatch(/"in 1 week" → 7/);
  });

  it('checks 2 and 8 carry worked code swaps', () => {
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

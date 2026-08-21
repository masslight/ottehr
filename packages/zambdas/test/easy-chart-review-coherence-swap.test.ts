import { PlannedAction } from 'utils/lib/easy-chart/api';
import { buildPrompt as buildSurfacePrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
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
        'PATIENT STATUS:',
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

import { describe, expect, it } from 'vitest';
import { buildPrompt, carrySwapPrimaryFromChartState } from '../src/ehr/easy-chart-review/index';

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

    it('mandates the two-intent swap when the note supports an alternative diagnosis', () => {
      expect(check9).toContain('MUST emit the same TWO-intent swap as check 2');
      expect(check9).toContain('NEVER a bare removal');
    });

    it('claims the swap for check 9 itself (not deferred to check 2) with the vaginitis example', () => {
      expect(check9).toContain('The swap belongs to THIS check');
      expect(check9).toContain('(N76.0)');
      expect(check9).toContain('(B37.3)');
    });

    it('allows bare removal only when no replacement exists, never into a dx-less chart', () => {
      expect(check9).toMatch(/Emit only the\s+remove-diagnosis when the note supports NO replacement diagnosis/);
      expect(check9).toContain('ZERO diagnoses');
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
      const b = buildPrompt(
        'Different synthetic narrative about an earache.',
        'Diagnoses: Acute vaginitis (N76.0) (primary)',
        undefined,
        'Jane Synth, 30yo female',
        'established',
        { pattern: 'follow-up', excerpt: 'follow up in a week' }
      );
      expect(prefixOf(a)).toBe(prefixOf(b));
    });

    it('every per-visit block header renders after the fixed prefix', () => {
      const p = buildPrompt(
        'Synthetic narrative.',
        'Diagnoses: Acute vaginitis (N76.0) (primary)',
        undefined,
        'Jane Synth, 30yo female',
        'new',
        { pattern: 'follow-up', excerpt: 'follow up in a week' }
      );
      const markerIdx = p.indexOf(marker);
      for (const header of [
        'PATIENT (authoritative',
        'PATIENT STATUS (authoritative',
        'ALREADY ON THE CHART (do NOT',
        'DISPOSITION TRIGGER (deterministic',
      ]) {
        expect(p.indexOf(header)).toBeGreaterThan(markerIdx);
      }
    });
  });

  describe('carrySwapPrimaryFromChartState on a coherence-originated swap', () => {
    it('carries primary from chartState onto the add when the model omits isPrimary', () => {
      const actions: Record<string, unknown>[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Acute vaginitis (N76.0) (primary); Headache (R51.9)');
      expect(actions[1].isPrimary).toBe(true);
    });

    it('marks the add secondary when the removed dx was not primary', () => {
      const actions: Record<string, unknown>[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3' },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Headache (R51.9) (primary); Acute vaginitis (N76.0)');
      expect(actions[1].isPrimary).toBe(false);
    });

    it('never overrides a model-stated isPrimary', () => {
      const actions: Record<string, unknown>[] = [
        { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)' },
        { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3', isPrimary: true },
      ];
      carrySwapPrimaryFromChartState(actions, 'Diagnoses: Headache (R51.9) (primary); Acute vaginitis (N76.0)');
      expect(actions[1].isPrimary).toBe(true);
    });
  });
});

// Which path a typed message takes. The single-shot AGENT returns exactly ONE action, so a message
// stating two readings has to go to the PLANNER or one of them is silently dropped — that is the bug
// this covers: "patient is 5'8", weighs 130lb" is 30 characters and one sentence, so every earlier
// heuristic sent it to the agent and only one vital was ever charted.
import { describe, expect, it } from 'vitest';
import { countVitalReadings, looksLikeNarrative } from '../../src/features/easy-charting/intent-logic';

describe('looksLikeNarrative', () => {
  describe('single requests stay on the agent path', () => {
    it('treats one vital as a single request', () => {
      expect(looksLikeNarrative('add height 68 inches')).toBe(false);
      expect(looksLikeNarrative('weight 130 lb')).toBe(false);
      expect(looksLikeNarrative('BP 122/78')).toBe(false);
      expect(looksLikeNarrative('temp 100.4 F')).toBe(false);
    });

    it('treats one non-vital command as a single request', () => {
      expect(looksLikeNarrative('add diagnosis sinusitis')).toBe(false);
      expect(looksLikeNarrative('remove medication Motrin')).toBe(false);
    });
  });

  describe('multiple readings go to the planner', () => {
    it('routes the reported case', () => {
      expect(looksLikeNarrative('patient is 5.8 inches, weights 130lb')).toBe(true);
      expect(looksLikeNarrative(`patient is 5'8", weighs 130lb`)).toBe(true);
    });

    it('routes other two-reading combinations', () => {
      expect(looksLikeNarrative('BP 122/78, temp 99.1 F')).toBe(true);
      expect(looksLikeNarrative('173 cm and 70 kg')).toBe(true);
      expect(looksLikeNarrative('temp 101 F, O2 sat 94%')).toBe(true);
    });
  });

  describe('existing routing rules still hold', () => {
    it('routes long messages', () => {
      expect(looksLikeNarrative('x'.repeat(140))).toBe(true);
    });

    it('routes multi-sentence messages', () => {
      expect(looksLikeNarrative('Patient here with ear pain. Started two days ago.')).toBe(true);
    });
  });
});

describe('countVitalReadings', () => {
  it('counts a reading only when a unit makes it one', () => {
    // Bare numbers are not readings — otherwise "cough for 5 days, seen 3 times" would route as if it
    // stated two vitals and the planner would be asked to chart durations as measurements.
    expect(countVitalReadings('cough for 5 days, seen 3 times this year')).toBe(0);
    expect(countVitalReadings('take 2 tablets 3 times daily')).toBe(0);
  });

  it('counts each distinct kind of reading once', () => {
    expect(countVitalReadings('130 lb')).toBe(1);
    expect(countVitalReadings('5 ft 8 in')).toBe(1);
    expect(countVitalReadings('130 lb and 68 inches')).toBe(2);
  });
});

import type {
  ExamCardCheckboxWithModalComponent,
  ExamCardNonTextComponent,
  ExamModalCheckboxOption,
} from 'config-types';
import { examConfig } from 'utils';
import { describe, expect, it } from 'vitest';

const inPersonConfig = examConfig.inPerson.default.components;

const NORMAL_LABELS = new Set([
  'Normal',
  'None',
  'Absent',
  'Intact',
  'Full',
  'Not present',
  'Neg',
  'Stable',
  'Midline',
  'No Hematoma',
  'Patent',
  '2+ normal',
  '<2s',
  '5/5',
  'No',
  'All non-tender',
]);

/**
 * Recursively collects all modal-exam components from an exam card's
 * normal and abnormal sections.
 */
function collectModalExamComponents(
  components: Record<string, ExamCardNonTextComponent>
): { key: string; component: ExamCardCheckboxWithModalComponent }[] {
  const result: { key: string; component: ExamCardCheckboxWithModalComponent }[] = [];
  for (const [key, comp] of Object.entries(components)) {
    if (comp.type === 'checkbox-with-modal') {
      result.push({ key, component: comp });
    }
  }
  return result;
}

describe('InPersonExamConfig modal-exam components', () => {
  describe('NORMAL_LABELS classification', () => {
    // Collect all modal-exam components across the entire config
    const allModalExams: { cardKey: string; compKey: string; component: ExamCardCheckboxWithModalComponent }[] = [];

    for (const [cardKey, card] of Object.entries(inPersonConfig)) {
      for (const { key, component } of collectModalExamComponents(card.components.normal)) {
        allModalExams.push({ cardKey, compKey: key, component });
      }
      for (const { key, component } of collectModalExamComponents(card.components.abnormal)) {
        allModalExams.push({ cardKey, compKey: key, component });
      }
    }

    it('should have at least one modal-exam component in the config', () => {
      expect(allModalExams.length).toBeGreaterThan(0);
    });

    it('should mark options with normal labels as abnormal: false (or undefined)', () => {
      const violations: string[] = [];

      for (const { cardKey, compKey, component } of allModalExams) {
        for (const [sectionKey, section] of Object.entries(component.modal)) {
          for (const [groupKey, group] of Object.entries(section.groups)) {
            for (const [optKey, option] of Object.entries(group.options)) {
              const opt = option as ExamModalCheckboxOption;
              if (NORMAL_LABELS.has(opt.label)) {
                if (opt.abnormal === true) {
                  violations.push(
                    `${cardKey}.${compKey} > ${sectionKey}.${groupKey}.${optKey} label="${opt.label}" has abnormal=true but should be false`
                  );
                }
              }
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('should mark options with non-normal labels as abnormal: true (when using opt())', () => {
      const violations: string[] = [];

      for (const { cardKey, compKey, component } of allModalExams) {
        for (const [sectionKey, section] of Object.entries(component.modal)) {
          for (const [groupKey, group] of Object.entries(section.groups)) {
            for (const [optKey, option] of Object.entries(group.options)) {
              const opt = option as ExamModalCheckboxOption;
              // Only check options that explicitly have the abnormal field set
              // (options created via opt() have it; manually defined skin options don't)
              if (!NORMAL_LABELS.has(opt.label) && opt.abnormal !== undefined) {
                if (opt.abnormal !== true) {
                  violations.push(
                    `${cardKey}.${compKey} > ${sectionKey}.${groupKey}.${optKey} label="${opt.label}" has abnormal=${opt.abnormal} but should be true`
                  );
                }
              }
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Extremity modal structure', () => {
    const extremitiesAbnormal = inPersonConfig.extremities.components.abnormal;

    it('should have shoulder-l as a modal-exam component', () => {
      const shoulderL = extremitiesAbnormal['shoulder-l'];
      expect(shoulderL).toBeDefined();
      expect(shoulderL.type).toBe('modal-exam');
    });

    it('should have expected sections in an extremity modal', () => {
      const shoulderL = extremitiesAbnormal['shoulder-l'] as ExamCardCheckboxWithModalComponent;
      const sectionKeys = Object.keys(shoulderL.modal);

      expect(sectionKeys).toContain('inspection');
      expect(sectionKeys).toContain('palpation');
      expect(sectionKeys).toContain('range-of-motion');
      expect(sectionKeys).toContain('neurovascular');
    });

    it('should have special-tests section for shoulder, knee, and wrist', () => {
      const shoulderL = extremitiesAbnormal['shoulder-l'] as ExamCardCheckboxWithModalComponent;
      const kneeL = extremitiesAbnormal['knee-l'] as ExamCardCheckboxWithModalComponent;
      const wristL = extremitiesAbnormal['wrist-l'] as ExamCardCheckboxWithModalComponent;

      expect(Object.keys(shoulderL.modal)).toContain('special-tests');
      expect(Object.keys(kneeL.modal)).toContain('special-tests');
      expect(Object.keys(wristL.modal)).toContain('special-tests');
    });

    it('should have ROM section with active, passive, and pain-with-motion groups', () => {
      const wristL = extremitiesAbnormal['wrist-l'] as ExamCardCheckboxWithModalComponent;
      const romSection = wristL.modal['range-of-motion'];

      expect(romSection).toBeDefined();
      expect(romSection.label).toBe('Range of Motion');

      const groupKeys = Object.keys(romSection.groups);
      expect(groupKeys).toContain('active-rom');
      expect(groupKeys).toContain('passive-rom');
      expect(groupKeys).toContain('pain-with-motion');
    });

    it('should have tenderness group in palpation section', () => {
      const elbowR = extremitiesAbnormal['elbow-r'] as ExamCardCheckboxWithModalComponent;
      const palpation = elbowR.modal.palpation;

      expect(palpation).toBeDefined();
      expect(Object.keys(palpation.groups)).toContain('tenderness');
    });

    it('should have neurovascular section with pulses, cap-refill, sensation, motor-strength', () => {
      const ankleL = extremitiesAbnormal['ankle-l'] as ExamCardCheckboxWithModalComponent;
      const neuro = ankleL.modal.neurovascular;

      expect(neuro).toBeDefined();
      const groupKeys = Object.keys(neuro.groups);
      expect(groupKeys).toContain('pulses');
      expect(groupKeys).toContain('cap-refill');
      expect(groupKeys).toContain('sensation');
      expect(groupKeys).toContain('motor-strength');
    });
  });

  describe('Lymph node modal structure', () => {
    const lymphAbnormal = inPersonConfig.lymph.components.abnormal;

    it('should have lymph node modal-exam items', () => {
      const anteriorCervicalL = lymphAbnormal['lymph-anterior-cervical-l'];
      expect(anteriorCervicalL).toBeDefined();
      expect(anteriorCervicalL.type).toBe('modal-exam');
    });

    it('should have status and node-characteristics sections', () => {
      const node = lymphAbnormal['lymph-anterior-cervical-l'] as ExamCardCheckboxWithModalComponent;
      const sectionKeys = Object.keys(node.modal);

      expect(sectionKeys).toContain('status');
      expect(sectionKeys).toContain('node-characteristics');
    });

    it('should have Normal, Enlarged, Tender options in status section', () => {
      const node = lymphAbnormal['lymph-anterior-cervical-l'] as ExamCardCheckboxWithModalComponent;
      const statusGroup = node.modal.status.groups.status;

      expect(statusGroup).toBeDefined();
      const optionLabels = Object.values(statusGroup.options).map((o) => o.label);
      expect(optionLabels).toContain('Normal');
      expect(optionLabels).toContain('Enlarged');
      expect(optionLabels).toContain('Tender');
    });

    it('should have size, texture, mobility, tenderness, overlying-skin groups in node-characteristics', () => {
      const node = lymphAbnormal['lymph-submandibular-r'] as ExamCardCheckboxWithModalComponent;
      const characteristics = node.modal['node-characteristics'];

      expect(characteristics).toBeDefined();
      const groupKeys = Object.keys(characteristics.groups);
      expect(groupKeys).toContain('size');
      expect(groupKeys).toContain('texture');
      expect(groupKeys).toContain('mobility');
      expect(groupKeys).toContain('tenderness');
      expect(groupKeys).toContain('overlying-skin');
    });
  });

  describe('Skin modals classification', () => {
    const skinAbnormal = inPersonConfig.skin.components.abnormal;

    it('should have common-skin-findings as a modal-exam', () => {
      const csf = skinAbnormal['common-skin-findings'];
      expect(csf).toBeDefined();
      expect(csf.type).toBe('modal-exam');
    });

    it('should have all common-skin-findings options without abnormal: false', () => {
      const csf = skinAbnormal['common-skin-findings'] as ExamCardCheckboxWithModalComponent;
      const violations: string[] = [];

      for (const [sectionKey, section] of Object.entries(csf.modal)) {
        for (const [groupKey, group] of Object.entries(section.groups)) {
          for (const [optKey, option] of Object.entries(group.options)) {
            const opt = option as ExamModalCheckboxOption;
            // Skin findings are all abnormal conditions, so abnormal should NOT be false.
            // These options don't use opt() - they have manual defaultValue: false
            // without an abnormal field, so abnormal will be undefined (which defaults
            // to abnormal in the UI).
            if (opt.abnormal === false) {
              violations.push(
                `${sectionKey}.${groupKey}.${optKey} label="${opt.label}" has abnormal=false but skin findings should all be abnormal`
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Paired L/R detection in extremities', () => {
    const extremitiesAbnormal = inPersonConfig.extremities.components.abnormal;
    const keys = Object.keys(extremitiesAbnormal);

    const expectedPairs = ['shoulder', 'elbow', 'wrist', 'hand-fingers', 'hip', 'knee', 'ankle', 'foot-toes'];

    it('should have all expected L/R pairs present', () => {
      for (const baseName of expectedPairs) {
        expect(keys).toContain(`${baseName}-l`);
        expect(keys).toContain(`${baseName}-r`);
      }
    });

    it('should have L/R pairs as consecutive entries detectable by the ExamTable pairing logic', () => {
      // The ExamTable pairs consecutive modal-exam entries where one ends with -l
      // and the next ends with -r (or vice versa), sharing the same base name.
      for (const baseName of expectedPairs) {
        const leftIdx = keys.indexOf(`${baseName}-l`);
        const rightIdx = keys.indexOf(`${baseName}-r`);

        expect(leftIdx).toBeGreaterThanOrEqual(0);
        expect(rightIdx).toBeGreaterThanOrEqual(0);

        // They should be consecutive
        expect(Math.abs(rightIdx - leftIdx)).toBe(1);

        // Left should come before right (the pairing logic checks -l then -r)
        expect(leftIdx).toBeLessThan(rightIdx);

        // Both should be modal-exam type
        expect(extremitiesAbnormal[`${baseName}-l`].type).toBe('modal-exam');
        expect(extremitiesAbnormal[`${baseName}-r`].type).toBe('modal-exam');
      }
    });

    it('should have L labels ending with " L" and R labels ending with " R"', () => {
      for (const baseName of expectedPairs) {
        const leftComp = extremitiesAbnormal[`${baseName}-l`] as ExamCardCheckboxWithModalComponent;
        const rightComp = extremitiesAbnormal[`${baseName}-r`] as ExamCardCheckboxWithModalComponent;

        expect(leftComp.label).toMatch(/ L$/);
        expect(rightComp.label).toMatch(/ R$/);

        // Base labels should match after stripping L/R suffix
        const leftBase = leftComp.label.replace(/ L$/, '');
        const rightBase = rightComp.label.replace(/ R$/, '');
        expect(leftBase).toBe(rightBase);
      }
    });
  });
});

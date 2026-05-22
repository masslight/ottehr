import type {
  ExamCardCheckboxWithModalComponent,
  ExamCardNonTextComponent,
  ExamModalCheckboxOption,
} from 'config-types';
import { examConfig } from 'utils';
import { assert, describe, expect, it } from 'vitest';

const configComponents = examConfig.default.components;
const normalLabels = examConfig.default.constants?.normalLabels;

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
  describe('uniform columns across modal sections', () => {
    it('should have the same column keys in every section of a checkbox-with-modal', () => {
      const violations: string[] = [];

      for (const [cardKey, card] of Object.entries(configComponents)) {
        const allComponents = [...Object.entries(card.components.normal), ...Object.entries(card.components.abnormal)];

        for (const [compKey, comp] of allComponents) {
          if (comp.type !== 'checkbox-with-modal') continue;

          const sections = Object.entries(comp.modal);
          if (sections.length <= 1) continue;

          const [, firstSection] = sections[0];
          const referenceColumns = Object.keys(firstSection.columns).sort().join(',');

          for (const [sectionKey, section] of sections.slice(1)) {
            const sectionColumns = Object.keys(section.columns).sort().join(',');
            if (sectionColumns !== referenceColumns) {
              violations.push(
                `${cardKey}.${compKey}: section "${sectionKey}" has columns [${sectionColumns}] but expected [${referenceColumns}]`
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('NORMAL_LABELS classification', () => {
    // Collect all modal-exam components across the entire config
    const allModalExams: { cardKey: string; compKey: string; component: ExamCardCheckboxWithModalComponent }[] = [];

    for (const [cardKey, card] of Object.entries(configComponents)) {
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

    it('should have normalLabels defined with at least one entry', () => {
      expect(normalLabels).toBeDefined();
      expect(normalLabels?.size).toBeGreaterThan(0);
    });

    assert(normalLabels != null, 'inPerson.default.constants.normalLabels should be defined');

    it('should mark options with normal labels as abnormal: false (or undefined)', () => {
      const violations: string[] = [];

      for (const { cardKey, compKey, component } of allModalExams) {
        for (const [sectionKey, section] of Object.entries(component.modal)) {
          for (const [columnKey, column] of Object.entries(section.columns)) {
            for (const [groupKey, group] of Object.entries(column.groups)) {
              for (const [optKey, option] of Object.entries(group.options)) {
                const opt = option as ExamModalCheckboxOption;
                if (normalLabels.has(opt.label)) {
                  if (opt.abnormal === true) {
                    violations.push(
                      `${cardKey}.${compKey} > ${sectionKey}.${columnKey}.${groupKey}.${optKey} label="${opt.label}" has abnormal=true but should be false`
                    );
                  }
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
          for (const [columnKey, column] of Object.entries(section.columns)) {
            for (const [groupKey, group] of Object.entries(column.groups)) {
              for (const [optKey, option] of Object.entries(group.options)) {
                const opt = option as ExamModalCheckboxOption;
                // Only check options that explicitly have the abnormal field set
                // (options created via opt() have it; manually defined skin options don't)
                if (!normalLabels.has(opt.label) && opt.abnormal !== undefined) {
                  if (opt.abnormal !== true) {
                    violations.push(
                      `${cardKey}.${compKey} > ${sectionKey}.${columnKey}.${groupKey}.${optKey} label="${opt.label}" has abnormal=${opt.abnormal} but should be true`
                    );
                  }
                }
              }
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});

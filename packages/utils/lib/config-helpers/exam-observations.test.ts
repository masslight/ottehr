import type { ExamItemConfig } from 'config-types';
import { describe, expect, it } from 'vitest';
import { buildExamFieldToSectionMap } from './exam-observations';

const makeConfig = (sections: ExamItemConfig): ExamItemConfig => sections;

describe('buildExamFieldToSectionMap', () => {
  it('returns an empty map for an empty config', () => {
    expect(buildExamFieldToSectionMap({}).size).toBe(0);
  });

  it('maps a checkbox in the normal slot to its section', () => {
    const config = makeConfig({
      heent: {
        label: 'Head',
        components: {
          normal: { normocephalic: { type: 'checkbox', label: 'Normocephalic', defaultValue: true } },
          abnormal: {},
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    expect(map.get('normocephalic')).toEqual({ sectionKey: 'heent', sectionLabel: 'Head' });
  });

  it('maps a checkbox-with-modal in the abnormal slot to its section', () => {
    const config = makeConfig({
      skin: {
        label: 'Skin',
        components: {
          normal: {},
          abnormal: {
            rash: { type: 'checkbox-with-modal', label: 'Rash', defaultValue: false, modal: {} } as any,
          },
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    expect(map.get('rash')).toEqual({ sectionKey: 'skin', sectionLabel: 'Skin' });
  });

  it('maps comment text fields to their section', () => {
    const config = makeConfig({
      abdomen: {
        label: 'Abdomen',
        components: {
          normal: {},
          abnormal: {},
          comment: { 'abdomen-comment': { type: 'text', label: 'Comment' } },
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    expect(map.get('abdomen-comment')).toEqual({ sectionKey: 'abdomen', sectionLabel: 'Abdomen' });
  });

  it('maps a dropdown parent key and all its option keys to the section', () => {
    const config = makeConfig({
      musculoskeletal: {
        label: 'Musculoskeletal',
        components: {
          normal: {
            gait: {
              type: 'dropdown',
              label: 'Gait',
              components: {
                'gait-normal': { type: 'option', label: 'Normal', defaultValue: false },
                'gait-antalgic': { type: 'option', label: 'Antalgic', defaultValue: false },
              },
            },
          },
          abnormal: {},
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    const expected = { sectionKey: 'musculoskeletal', sectionLabel: 'Musculoskeletal' };
    expect(map.get('gait')).toEqual(expected);
    expect(map.get('gait-normal')).toEqual(expected);
    expect(map.get('gait-antalgic')).toEqual(expected);
  });

  it('maps a multi-select parent key and all its option keys to the section', () => {
    const config = makeConfig({
      respiratory: {
        label: 'Respiratory',
        components: {
          normal: {},
          abnormal: {
            'breath-sounds': {
              type: 'multi-select',
              label: 'Breath Sounds',
              defaultValue: false,
              options: {
                wheezing: { type: 'checkbox', label: 'Wheezing', defaultValue: false } as any,
                crackles: { type: 'checkbox', label: 'Crackles', defaultValue: false } as any,
              },
            },
          },
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    const expected = { sectionKey: 'respiratory', sectionLabel: 'Respiratory' };
    expect(map.get('breath-sounds')).toEqual(expected);
    expect(map.get('wheezing')).toEqual(expected);
    expect(map.get('crackles')).toEqual(expected);
  });

  it('maps form element keys (not the form key itself) to the section', () => {
    const config = makeConfig({
      neurological: {
        label: 'Neurological',
        components: {
          normal: {},
          abnormal: {
            'cranial-nerves': {
              type: 'form',
              label: 'Cranial Nerves',
              components: {
                'cn-ii': { type: 'form-element', defaultValue: false },
                'cn-iii': { type: 'form-element', defaultValue: false },
              },
              fields: {},
            },
          },
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    const expected = { sectionKey: 'neurological', sectionLabel: 'Neurological' };
    expect(map.has('cranial-nerves')).toBe(false);
    expect(map.get('cn-ii')).toEqual(expected);
    expect(map.get('cn-iii')).toEqual(expected);
  });

  it("recursively maps fields inside a column to the column's parent section (not the column label)", () => {
    const config = makeConfig({
      extremities: {
        label: 'Extremities',
        components: {
          normal: {
            'upper-extremities': {
              type: 'column',
              label: 'Upper',
              components: {
                'grip-strength': { type: 'checkbox', label: 'Grip Strength Normal', defaultValue: true },
              },
            },
          },
          abnormal: {},
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    // The column key itself is NOT added; only its children are
    expect(map.has('upper-extremities')).toBe(false);
    expect(map.get('grip-strength')).toEqual({ sectionKey: 'extremities', sectionLabel: 'Extremities' });
  });

  it('maps fields from multiple sections to their respective sections', () => {
    const config = makeConfig({
      eyes: {
        label: 'Eyes',
        components: {
          normal: { eomi: { type: 'checkbox', label: 'EOMI', defaultValue: true } },
          abnormal: {},
          comment: {},
        },
      },
      cardiovascular: {
        label: 'Cardiovascular',
        components: {
          normal: { rrr: { type: 'checkbox', label: 'RRR', defaultValue: true } },
          abnormal: {},
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    expect(map.get('eomi')).toEqual({ sectionKey: 'eyes', sectionLabel: 'Eyes' });
    expect(map.get('rrr')).toEqual({ sectionKey: 'cardiovascular', sectionLabel: 'Cardiovascular' });
  });

  it('maps fields from both normal and abnormal slots of the same section to the same section info', () => {
    const config = makeConfig({
      throat: {
        label: 'Throat',
        components: {
          normal: { 'oropharynx-normal': { type: 'checkbox', label: 'Clear', defaultValue: true } },
          abnormal: { 'oropharynx-abnormal': { type: 'checkbox', label: 'Erythema', defaultValue: false } },
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    const expected = { sectionKey: 'throat', sectionLabel: 'Throat' };
    expect(map.get('oropharynx-normal')).toEqual(expected);
    expect(map.get('oropharynx-abnormal')).toEqual(expected);
  });

  it('maps a text component nested inside a column to the section', () => {
    // text components can't sit directly in normal/abnormal (those slots are ExamCardNonTextComponent),
    // but a column's `components` is Record<string, ExamCardComponent> which includes text,
    // so this is the reachable path for the text branch in walk().
    const config = makeConfig({
      general: {
        label: 'General',
        components: {
          normal: {
            'appearance-col': {
              type: 'column',
              label: 'Appearance',
              components: {
                'appearance-note': { type: 'text', label: 'Appearance note' },
              },
            },
          },
          abnormal: {},
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    expect(map.get('appearance-note')).toEqual({ sectionKey: 'general', sectionLabel: 'General' });
  });

  it("maps a dropdown nested inside a column to the column's parent section", () => {
    const config = makeConfig({
      lymph: {
        label: 'Lymph Nodes',
        components: {
          normal: {},
          abnormal: {
            'cervical-col': {
              type: 'column',
              label: 'Cervical',
              components: {
                'cervical-nodes': {
                  type: 'dropdown',
                  label: 'Cervical Nodes',
                  components: {
                    'cervical-nodes-tender': { type: 'option', label: 'Tender', defaultValue: false },
                  },
                },
              },
            },
          },
          comment: {},
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    const expected = { sectionKey: 'lymph', sectionLabel: 'Lymph Nodes' };
    expect(map.get('cervical-nodes')).toEqual(expected);
    expect(map.get('cervical-nodes-tender')).toEqual(expected);
    expect(map.has('cervical-col')).toBe(false);
  });

  it('returns a map whose size equals the total number of registered fields across all sections', () => {
    const config = makeConfig({
      sectionA: {
        label: 'A',
        components: {
          normal: {
            a1: { type: 'checkbox', label: 'A1', defaultValue: false },
            'a2-dropdown': {
              type: 'dropdown',
              label: 'A2',
              components: {
                'a2-opt1': { type: 'option', label: 'Opt1', defaultValue: false },
                'a2-opt2': { type: 'option', label: 'Opt2', defaultValue: false },
              },
            },
          },
          abnormal: {},
          comment: { 'a-comment': { type: 'text', label: 'Comment' } },
        },
      },
    });

    const map = buildExamFieldToSectionMap(config);
    // a1 + a2-dropdown + a2-opt1 + a2-opt2 + a-comment = 5
    expect(map.size).toBe(5);
  });
});

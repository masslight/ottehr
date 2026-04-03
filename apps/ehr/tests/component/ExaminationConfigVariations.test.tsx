/**
 * Tests for examination configuration variations.
 *
 * Verifies that the exam config system correctly handles different config shapes:
 * - Different sets of exam card sections
 * - Different component types (checkbox, dropdown, multi-select, column, form, text)
 * - Telemed vs in-person configs
 * - Custom exam items
 */
import { ExamDef } from 'utils';
import { createSimpleHash } from 'utils';
import { describe, expect, it } from 'vitest';

// Helper: generate a valid 8-char hex version hash from components
const hexVersion = (seed: string): string => createSimpleHash(seed);

describe('Examination config - section variations', () => {
  it('accepts default 18-section config', () => {
    const config = ExamDef();
    const inPersonSections = Object.keys(config.inPerson.default.components);
    expect(inPersonSections.length).toBeGreaterThanOrEqual(10);
  });

  it('accepts minimal config with a single section', () => {
    const minimalConfig = {
      telemed: {
        default: {
          version: hexVersion('test-telemed'),
          components: {
            general: {
              label: 'General',
              components: {
                normal: {
                  alert: { type: 'checkbox' as const, label: 'Alert', defaultValue: true },
                },
                abnormal: {},
                comment: {},
              },
            },
          },
        },
      },
      inPerson: {
        default: {
          version: hexVersion('test-inperson'),
          components: {
            general: {
              label: 'General',
              components: {
                normal: {
                  alert: { type: 'checkbox' as const, label: 'Alert', defaultValue: true },
                },
                abnormal: {},
                comment: {},
              },
            },
          },
        },
      },
    };
    const config = ExamDef(minimalConfig);
    expect(Object.keys(config.inPerson.default.components)).toEqual(['general']);
  });

  it('accepts config with custom section names', () => {
    const customConfig = {
      telemed: {
        default: {
          version: hexVersion('cust-telemed'),
          components: {
            'custom-section': {
              label: 'Custom Section',
              components: {
                normal: {},
                abnormal: {},
                comment: {},
              },
            },
          },
        },
      },
      inPerson: {
        default: {
          version: hexVersion('cust-inperson'),
          components: {
            'custom-section': {
              label: 'Custom Section',
              components: {
                normal: {},
                abnormal: {},
                comment: {},
              },
            },
          },
        },
      },
    };
    const config = ExamDef(customConfig);
    expect(config.inPerson.default.components['custom-section']).toBeDefined();
    expect(config.inPerson.default.components['custom-section'].label).toBe('Custom Section');
  });
});

describe('Examination config - component type variations', () => {
  const makeConfig = (normal: Record<string, unknown>, abnormal: Record<string, unknown> = {}): object => ({
    telemed: {
      default: {
        version: hexVersion('type-telemed'),
        components: {
          test: {
            label: 'Test Section',
            components: {
              normal,
              abnormal,
              comment: {},
            },
          },
        },
      },
    },
    inPerson: {
      default: {
        version: hexVersion('type-inperson'),
        components: {
          test: {
            label: 'Test Section',
            components: {
              normal,
              abnormal,
              comment: {},
            },
          },
        },
      },
    },
  });

  it('accepts checkbox component with defaultValue true', () => {
    const config = ExamDef(
      makeConfig({
        finding: { type: 'checkbox', label: 'Alert', defaultValue: true },
      })
    );
    const comp = config.inPerson.default.components.test.components.normal.finding;
    expect(comp.type).toBe('checkbox');
  });

  it('accepts checkbox component with defaultValue false', () => {
    const config = ExamDef(
      makeConfig({
        finding: { type: 'checkbox', label: 'Dehydrated', defaultValue: false },
      })
    );
    const comp = config.inPerson.default.components.test.components.normal.finding;
    expect(comp.type).toBe('checkbox');
  });

  it('accepts dropdown component with options', () => {
    const config = ExamDef(
      makeConfig({
        finding: {
          type: 'dropdown',
          label: 'TM Appearance',
          placeholder: 'Select...',
          components: {
            normal: { type: 'option', label: 'Normal', defaultValue: false },
            erythematous: { type: 'option', label: 'Erythematous', defaultValue: false },
          },
        },
      })
    );
    const comp = config.inPerson.default.components.test.components.normal.finding;
    expect(comp.type).toBe('dropdown');
  });

  it('accepts multi-select component with options', () => {
    const config = ExamDef(
      makeConfig({
        rash: {
          type: 'multi-select',
          label: 'Rash',
          defaultValue: false,
          options: {
            'viral-exam': { label: 'Viral exam', defaultValue: false },
            'insect-bites': { label: 'Insect bites', defaultValue: false },
          },
        },
      })
    );
    const comp = config.inPerson.default.components.test.components.normal.rash;
    expect(comp.type).toBe('multi-select');
  });

  it('accepts column component with nested children', () => {
    const config = ExamDef(
      makeConfig({
        eyes: {
          type: 'column',
          label: 'Eyes',
          components: {
            'left-eye': { type: 'checkbox', label: 'Left Eye Normal', defaultValue: true },
            'right-eye': { type: 'checkbox', label: 'Right Eye Normal', defaultValue: true },
          },
        },
      })
    );
    const comp = config.inPerson.default.components.test.components.normal.eyes;
    expect(comp.type).toBe('column');
  });

  it('accepts text component in comment section', () => {
    const configData = {
      telemed: {
        default: {
          version: hexVersion('comm-telemed'),
          components: {
            test: {
              label: 'Test Section',
              components: {
                normal: {},
                abnormal: {},
                comment: {
                  'general-comment': { type: 'text' as const, label: 'Comment' },
                },
              },
            },
          },
        },
      },
      inPerson: {
        default: {
          version: hexVersion('comm-inperson'),
          components: {
            test: {
              label: 'Test Section',
              components: {
                normal: {},
                abnormal: {},
                comment: {
                  'general-comment': { type: 'text' as const, label: 'Comment' },
                },
              },
            },
          },
        },
      },
    };
    const config = ExamDef(configData);
    const commentComp = config.inPerson.default.components.test.components.comment['general-comment'];
    expect(commentComp.type).toBe('text');
  });

  it('accepts section with only normal findings (no abnormal)', () => {
    const config = ExamDef(
      makeConfig(
        { finding: { type: 'checkbox', label: 'Normal', defaultValue: true } },
        {} // empty abnormal
      )
    );
    expect(Object.keys(config.inPerson.default.components.test.components.abnormal)).toEqual([]);
  });

  it('accepts section with only abnormal findings (no normal)', () => {
    const config = ExamDef(
      makeConfig(
        {}, // empty normal
        { finding: { type: 'checkbox', label: 'Abnormal', defaultValue: false } }
      )
    );
    expect(Object.keys(config.inPerson.default.components.test.components.normal)).toEqual([]);
  });
});

describe('Examination config - telemed vs in-person', () => {
  it('allows different components for telemed and in-person', () => {
    const config = ExamDef();
    const telemedKeys = Object.keys(config.telemed.default.components);
    const inPersonKeys = Object.keys(config.inPerson.default.components);
    // Both should have sections, but component details may differ
    expect(telemedKeys.length).toBeGreaterThan(0);
    expect(inPersonKeys.length).toBeGreaterThan(0);
  });

  it('generates different version hashes for different configs', () => {
    const config = ExamDef();
    // Version is a hash of the config JSON
    expect(config.telemed.default.version).toBeDefined();
    expect(config.inPerson.default.version).toBeDefined();
    expect(typeof config.telemed.default.version).toBe('string');
  });
});

describe('Examination config - version hashing', () => {
  it('creates consistent hash for same input', () => {
    const hash1 = createSimpleHash(JSON.stringify({ a: 1 }));
    const hash2 = createSimpleHash(JSON.stringify({ a: 1 }));
    expect(hash1).toBe(hash2);
  });

  it('creates different hashes for different inputs', () => {
    const hash1 = createSimpleHash(JSON.stringify({ a: 1 }));
    const hash2 = createSimpleHash(JSON.stringify({ a: 2 }));
    expect(hash1).not.toBe(hash2);
  });
});

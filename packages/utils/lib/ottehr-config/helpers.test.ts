import { describe, expect, it } from 'vitest';
import { mergeAndFreezeConfigObjects } from './helpers';

describe('mergeAndFreezeConfigObjects', () => {
  describe('array handling', () => {
    it('should replace entire array when override provides an array', () => {
      const baseConfig = {
        items: ['a', 'b', 'c'],
      };
      const overrideConfig = {
        items: ['x', 'y'],
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.items).toEqual(['x', 'y']);
      expect(result.items).toHaveLength(2);
    });

    it('should not merge array elements from base into override array', () => {
      const baseConfig = {
        tags: [
          { id: 1, name: 'base1' },
          { id: 2, name: 'base2' },
        ],
      };
      const overrideConfig = {
        tags: [{ id: 3, name: 'override1' }],
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0]).toEqual({ id: 3, name: 'override1' });
    });

    it('should use base array when override does not provide the array field', () => {
      const baseConfig = {
        items: ['a', 'b', 'c'],
        name: 'base',
      };
      const overrideConfig = {
        name: 'override',
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.items).toEqual(['a', 'b', 'c']);
      expect(result.name).toBe('override');
    });

    it('should handle empty override array replacing non-empty base array', () => {
      const baseConfig = {
        items: ['a', 'b', 'c'],
      };
      const overrideConfig = {
        items: [] as string[],
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.items).toEqual([]);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('scalar handling', () => {
    it('should use override value for string fields', () => {
      const baseConfig = {
        name: 'baseName',
      };
      const overrideConfig = {
        name: 'overrideName',
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.name).toBe('overrideName');
    });

    it('should use override value for number fields', () => {
      const baseConfig = {
        count: 10,
      };
      const overrideConfig = {
        count: 42,
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.count).toBe(42);
    });

    it('should use override value for boolean fields', () => {
      const baseConfig = {
        enabled: true,
      };
      const overrideConfig = {
        enabled: false,
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.enabled).toBe(false);
    });

    it('should use base value when override does not provide the field', () => {
      const baseConfig = {
        name: 'baseName',
        count: 10,
      };
      const overrideConfig = {
        name: 'overrideName',
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.name).toBe('overrideName');
      expect(result.count).toBe(10);
    });
  });

  describe('object handling', () => {
    it('should deep merge objects - override fields win', () => {
      const baseConfig = {
        settings: {
          theme: 'light',
          fontSize: 14,
        },
      };
      const overrideConfig = {
        settings: {
          theme: 'dark',
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.settings.theme).toBe('dark');
    });

    it('should preserve base object fields not present in override', () => {
      const baseConfig = {
        settings: {
          theme: 'light',
          fontSize: 14,
          lineHeight: 1.5,
        },
      };
      const overrideConfig = {
        settings: {
          theme: 'dark',
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.settings.theme).toBe('dark');
      expect(result.settings.fontSize).toBe(14);
      expect(result.settings.lineHeight).toBe(1.5);
    });

    it('should include override fields not present in base', () => {
      const baseConfig = {
        settings: {
          theme: 'light',
        },
      };
      const overrideConfig = {
        settings: {
          fontSize: 16,
          lineHeight: 1.8,
        },
        newSection: {
          enabled: true,
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig) as any;

      expect(result.settings.theme).toBe('light');
      expect(result.settings.fontSize).toBe(16);
      expect(result.settings.lineHeight).toBe(1.8);
      expect(result.newSection.enabled).toBe(true);
    });

    it('should handle deeply nested object merging', () => {
      const baseConfig = {
        level1: {
          level2: {
            level3: {
              baseOnly: 'preserved',
              shared: 'base',
              overrideOnly: '',
              overrideExtended: {
                foo: 'foo',
                bar: 'bar',
              },
            },
          },
        },
      };
      const overrideConfig = {
        level1: {
          level2: {
            level3: {
              shared: 'override',
              overrideOnly: 'added',
              overrideExtended: {
                foo: 'foo',
                bar: 'bar',
                baz: 'baz',
              },
            },
          },
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.level1.level2.level3.baseOnly).toBe('preserved');
      expect(result.level1.level2.level3.shared).toBe('override');
      expect(result.level1.level2.level3.overrideOnly).toBe('added');
      expect(result.level1.level2.level3.overrideExtended.foo).toBe('foo');
      expect(result.level1.level2.level3.overrideExtended.bar).toBe('bar');
      expect(result.level1.level2.level3.overrideExtended.baz).toBe('baz');

      const defaultFormFields = {
        consentForms: {
          linkId: 'consent-forms-page',
          title: 'Complete consent forms',
          reviewText: 'Consent forms',
          triggers: [
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'completed',
            },
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'amended',
            },
          ],
          enableBehavior: 'all',
          items: {
            hipaaAcknowledgement: {
              key: 'hipaa-acknowledgement',
              label: 'I have reviewed and accept [HIPAA Acknowledgement](/hipaa_notice_template.pdf)',
              type: 'boolean',
              triggers: [
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'completed',
                },
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'amended',
                },
              ],
              enableBehavior: 'all',
              permissibleValue: true,
              disabledDisplay: 'disabled',
            },
            consentToTreat: {
              key: 'consent-to-treat',
              label:
                'I have reviewed and accept [Consent to Treat, Guarantee of Payment & Card on File Agreement](/consent_to_treat_template.pdf)',
              type: 'boolean',
              triggers: [
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'completed',
                },
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'amended',
                },
              ],
              enableBehavior: 'all',
              permissibleValue: true,
              disabledDisplay: 'disabled',
            },
            signature: {
              key: 'signature',
              label: 'Signature',
              type: 'string',
              dataType: 'Signature',
              triggers: [
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'completed',
                },
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'amended',
                },
              ],
              enableBehavior: 'all',
              disabledDisplay: 'disabled',
            },
            fullName: {
              key: 'full-name',
              label: 'Full name',
              type: 'string',
              triggers: [
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'completed',
                },
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'amended',
                },
              ],
              enableBehavior: 'all',
              autocomplete: 'section-consent-forms shipping name',
              disabledDisplay: 'disabled',
            },
            consentFormSignerRelationship: {
              key: 'consent-form-signer-relationship',
              label: 'Relationship to the patient',
              type: 'choice',
              options: [
                { label: 'option 1', value: 'option1' },
                { label: 'option 2', value: 'option2' },
              ],
              triggers: [
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'completed',
                },
                {
                  targetQuestionLinkId: '$status',
                  effect: ['enable'],
                  operator: '!=',
                  answerString: 'amended',
                },
              ],
              enableBehavior: 'all',
              disabledDisplay: 'disabled',
            },
          },
          hiddenFields: [],
          requiredFields: [
            'hipaa-acknowledgement',
            'consent-to-treat',
            'signature',
            'full-name',
            'consent-form-signer-relationship',
          ],
        },
      };

      const overrideFormFields = {
        consentForms: {
          items: {
            hipaaAcknowledgement: {
              label: 'I have reviewed and agree I guess',
            },
            consentToTreat: {
              label: 'Sure these look fine',
            },
            financialResponsibility: {
              key: 'financial-responsibility',
              label: 'Yeah im good for it',
              type: 'boolean',
              permissibleValue: true,
            },
            rightsAndResponsibilities: {
              key: 'rights-and-responsibilities',
              label: 'Yup',
              type: 'boolean',
              permissibleValue: true,
            },
          },
        },
      };
      const result2 = mergeAndFreezeConfigObjects(defaultFormFields, overrideFormFields);
      expect(result2.consentForms.items.hipaaAcknowledgement.label).toBe('I have reviewed and agree I guess');
      expect(result2.consentForms.items.consentToTreat.label).toBe('Sure these look fine');
      expect(result2.consentForms.items.financialResponsibility.label).toBe('Yeah im good for it');
      expect(result2.consentForms.items.rightsAndResponsibilities.label).toBe('Yup');
    });
  });

  describe('mixed scenarios', () => {
    it('should handle object containing arrays - arrays are replaced not merged', () => {
      const baseConfig = {
        user: {
          name: 'John',
          roles: ['admin', 'user'],
          preferences: {
            notifications: true,
            theme: 'light',
          },
        },
      };
      const overrideConfig = {
        user: {
          roles: ['guest'],
          preferences: {
            theme: 'dark',
          },
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.user.name).toBe('John');
      expect(result.user.roles).toEqual(['guest']);
      expect(result.user.preferences.notifications).toBe(true);
      expect(result.user.preferences.theme).toBe('dark');
    });

    it('should handle complex config with multiple field types', () => {
      const baseConfig = {
        appName: 'MyApp',
        version: 1,
        features: ['feature1', 'feature2'],
        settings: {
          debug: false,
          maxRetries: 3,
          endpoints: ['http://api1.com', 'http://api2.com'],
        },
      };
      const overrideConfig = {
        version: 2,
        features: ['feature3'],
        settings: {
          debug: true,
          endpoints: ['http://override.com'],
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.appName).toBe('MyApp');
      expect(result.version).toBe(2);
      expect(result.features).toEqual(['feature3']);
      expect(result.settings.debug).toBe(true);
      expect(result.settings.maxRetries).toBe(3);
      expect(result.settings.endpoints).toEqual(['http://override.com']);
    });
  });

  describe('edge cases', () => {
    it('should return frozen object', () => {
      const baseConfig = { name: 'test' };
      const overrideConfig = {};

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should not mutate original base config', () => {
      const baseConfig = {
        settings: { theme: 'light' },
      };
      const overrideConfig = {
        settings: { theme: 'dark' },
      };

      mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(baseConfig.settings.theme).toBe('light');
    });

    it('should not mutate original override config', () => {
      const baseConfig = {
        settings: { theme: 'light' },
      };
      const overrideConfig = {
        settings: { theme: 'dark' },
      };

      mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(overrideConfig.settings.theme).toBe('dark');
    });

    it('should handle empty override config', () => {
      const baseConfig = {
        name: 'test',
        items: [1, 2, 3],
      };
      const overrideConfig = {};

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.name).toBe('test');
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should handle undefined values in override', () => {
      const baseConfig = {
        name: 'test',
        value: 'base',
      };
      const overrideConfig = {
        value: undefined,
      } as any;

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      // undefined in override should not replace base value (lodash merge behavior)
      expect(result.value).toBe('base');
    });
  });
});

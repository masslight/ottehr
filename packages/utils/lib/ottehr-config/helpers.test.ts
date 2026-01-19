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
            },
          },
        },
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      expect(result.level1.level2.level3.baseOnly).toBe('preserved');
      expect(result.level1.level2.level3.shared).toBe('override');
      expect(result.level1.level2.level3.overrideOnly).toBe('added');
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
      };

      const result = mergeAndFreezeConfigObjects(baseConfig, overrideConfig);

      // undefined in override should not replace base value (lodash merge behavior)
      expect(result.value).toBe('base');
    });
  });
});

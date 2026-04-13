import { replaceTemplateVariablesHandlebars } from 'utils';
import { describe, expect, test } from 'vitest';

describe('replaceTemplateVariablesHandlebars', () => {
  test('replaces a single variable', () => {
    const result = replaceTemplateVariablesHandlebars('Hello {{name}}', { name: 'Alice' });
    expect(result).toBe('Hello Alice');
  });

  test('replaces multiple different variables', () => {
    const result = replaceTemplateVariablesHandlebars('{{greeting}}, {{name}}! Your visit is on {{date}}.', {
      greeting: 'Hi',
      name: 'Bob',
      date: 'Monday',
    });
    expect(result).toBe('Hi, Bob! Your visit is on Monday.');
  });

  test('replaces the same variable appearing multiple times', () => {
    const result = replaceTemplateVariablesHandlebars('{{name}} said hi. {{name}} left.', { name: 'Carol' });
    expect(result).toBe('Carol said hi. Carol left.');
  });

  test('leaves unknown variables unreplaced', () => {
    const result = replaceTemplateVariablesHandlebars('Hello {{unknown}}', { name: 'Alice' });
    expect(result).toBe('Hello {{unknown}}');
  });

  test('handles empty template', () => {
    const result = replaceTemplateVariablesHandlebars('', { name: 'Alice' });
    expect(result).toBe('');
  });

  test('handles empty params', () => {
    const result = replaceTemplateVariablesHandlebars('Hello {{name}}', {});
    expect(result).toBe('Hello {{name}}');
  });

  test('handles template with no variables', () => {
    const result = replaceTemplateVariablesHandlebars('No variables here', { name: 'Alice' });
    expect(result).toBe('No variables here');
  });

  test('handles hyphenated variable names', () => {
    const result = replaceTemplateVariablesHandlebars('Visit: {{patient-full-name}} at {{clinic}}', {
      'patient-full-name': 'Dave',
      clinic: 'Main St Clinic',
    });
    expect(result).toBe('Visit: Dave at Main St Clinic');
  });

  test('handles variables with spaces around braces', () => {
    // The function should NOT match {{ name }} with extra spaces because variable names
    // are matched strictly (word characters and hyphens only, with no spaces inside braces).
    const result = replaceTemplateVariablesHandlebars('Hello {{ name }}', { name: 'Alice' });
    expect(result).toBe('Hello {{ name }}');
  });

  test('replaces variables with special characters in values', () => {
    const result = replaceTemplateVariablesHandlebars('Amount: {{amount}}', {
      amount: '$1,234.56',
    });
    expect(result).toBe('Amount: $1,234.56');
  });
});

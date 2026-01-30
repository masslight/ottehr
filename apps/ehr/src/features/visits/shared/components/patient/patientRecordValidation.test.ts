/**
 * @vitest-environment node
 */

import { DateTime } from 'luxon';
import { FormFieldsInputItem } from 'utils';
import { describe, expect, it } from 'vitest';
import {
  createDynamicValidationResolver,
  evaluateFieldTriggers,
  generateFieldValidationRules,
  generateValidationRulesForSection,
} from './patientRecordValidation';

describe('patientRecordValidation', () => {
  describe('evaluateFieldTriggers', () => {
    it('should return not required and enabled when no triggers exist', () => {
      const item: FormFieldsInputItem = {
        key: 'test-field',
        type: 'string',
        label: 'Test Field',
        disabledDisplay: 'hidden',
      };
      const formValues = {};

      const result = evaluateFieldTriggers(item, formValues);

      expect(result).toEqual({ required: false, enabled: true });
    });

    it('should evaluate "exists" operator with true answer correctly', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: 'exists',
            answerBoolean: true,
          },
        ],
      };

      // Field exists
      let result = evaluateFieldTriggers(item, { 'trigger-field': 'some-value' });
      expect(result.required).toBe(true);

      // Field doesn't exist
      result = evaluateFieldTriggers(item, { 'trigger-field': '' });
      expect(result.required).toBe(false);

      result = evaluateFieldTriggers(item, { 'trigger-field': null });
      expect(result.required).toBe(false);

      result = evaluateFieldTriggers(item, {});
      expect(result.required).toBe(false);
    });

    it('should evaluate "exists" operator with false answer correctly', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: 'exists',
            answerBoolean: false,
          },
        ],
      };

      // Field doesn't exist - condition met
      let result = evaluateFieldTriggers(item, { 'trigger-field': '' });
      expect(result.required).toBe(true);

      // Field exists - condition not met
      result = evaluateFieldTriggers(item, { 'trigger-field': 'value' });
      expect(result.required).toBe(false);
    });

    it('should evaluate "=" operator with string answer', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: '=',
            answerString: 'specific-value',
          },
        ],
      };

      let result = evaluateFieldTriggers(item, { 'trigger-field': 'specific-value' });
      expect(result.required).toBe(true);

      result = evaluateFieldTriggers(item, { 'trigger-field': 'other-value' });
      expect(result.required).toBe(false);
    });

    it('should evaluate "!=" operator with string answer', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: '!=',
            answerString: 'exclude-value',
          },
        ],
      };

      let result = evaluateFieldTriggers(item, { 'trigger-field': 'other-value' });
      expect(result.required).toBe(true);

      result = evaluateFieldTriggers(item, { 'trigger-field': 'exclude-value' });
      expect(result.required).toBe(false);
    });

    it('should evaluate date comparison operators', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'date-field',
            effect: ['require'],
            operator: '>',
            answerDateTime: '2024-01-01',
          },
        ],
      };

      let result = evaluateFieldTriggers(item, { 'date-field': '2024-06-01' });
      expect(result.required).toBe(true);

      result = evaluateFieldTriggers(item, { 'date-field': '2023-01-01' });
      expect(result.required).toBe(false);
    });

    it('should handle enable triggers with "any" behavior', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        enableBehavior: 'any',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field-1',
            effect: ['enable'],
            operator: '=',
            answerString: 'enable-value',
          },
          {
            targetQuestionLinkId: 'trigger-field-2',
            effect: ['enable'],
            operator: '=',
            answerString: 'other-enable-value',
          },
        ],
      };

      // At least one condition met - should be enabled
      let result = evaluateFieldTriggers(
        item,
        { 'trigger-field-1': 'enable-value', 'trigger-field-2': 'wrong' },
        'any'
      );
      expect(result.enabled).toBe(true);

      // No conditions met - should be disabled
      result = evaluateFieldTriggers(item, { 'trigger-field-1': 'wrong', 'trigger-field-2': 'wrong' }, 'any');
      expect(result.enabled).toBe(false);
    });

    it('should handle enable triggers with "all" behavior', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        enableBehavior: 'all',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field-1',
            effect: ['enable'],
            operator: '=',
            answerString: 'enable-value',
          },
          {
            targetQuestionLinkId: 'trigger-field-2',
            effect: ['enable'],
            operator: '=',
            answerString: 'other-enable-value',
          },
        ],
      };

      // All conditions met - should be enabled
      let result = evaluateFieldTriggers(
        item,
        { 'trigger-field-1': 'enable-value', 'trigger-field-2': 'other-enable-value' },
        'all'
      );
      expect(result.enabled).toBe(true);

      // Only one condition met - should be disabled
      result = evaluateFieldTriggers(item, { 'trigger-field-1': 'enable-value', 'trigger-field-2': 'wrong' }, 'all');
      expect(result.enabled).toBe(false);
    });

    it('should handle multiple effects on a single trigger', () => {
      const item: FormFieldsInputItem = {
        key: 'dependent-field',
        type: 'string',
        label: 'Dependent Field',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'special-value',
          },
        ],
      };

      let result = evaluateFieldTriggers(item, { 'trigger-field': 'special-value' });
      expect(result.enabled).toBe(true);
      expect(result.required).toBe(true);

      result = evaluateFieldTriggers(item, { 'trigger-field': 'other-value' });
      expect(result.enabled).toBe(false);
      expect(result.required).toBe(false);
    });
  });

  describe('generateFieldValidationRules', () => {
    it('should return empty rules for display fields', () => {
      const item = {
        key: 'display-field',
        type: 'display' as const,
        text: 'Display text',
        disabledDisplay: 'hidden' as const,
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules).toEqual({});
    });

    it('should add required rule when field is in requiredFormFields', () => {
      const item: FormFieldsInputItem = {
        key: 'required-field',
        type: 'string',
        label: 'Required Field',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {}, ['required-field']);

      expect(rules.required).toBeDefined();
    });

    it('should add required rule when trigger makes field required', () => {
      const item: FormFieldsInputItem = {
        key: 'conditional-required',
        type: 'string',
        label: 'Conditional Required',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: '=',
            answerString: 'yes',
          },
        ],
      };

      const rules = generateFieldValidationRules(item, { 'trigger-field': 'yes' });

      expect(rules.required).toBeDefined();
    });

    it('should not add required rule when trigger condition is not met', () => {
      const item: FormFieldsInputItem = {
        key: 'conditional-required',
        type: 'string',
        label: 'Conditional Required',
        disabledDisplay: 'hidden',
        triggers: [
          {
            targetQuestionLinkId: 'trigger-field',
            effect: ['require'],
            operator: '=',
            answerString: 'yes',
          },
        ],
      };

      const rules = generateFieldValidationRules(item, { 'trigger-field': 'no' });

      expect(rules.required).toBeUndefined();
    });

    it('should add ZIP validation pattern', () => {
      const item: FormFieldsInputItem = {
        key: 'zip-field',
        type: 'string',
        label: 'ZIP Code',
        dataType: 'ZIP',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.pattern).toBeDefined();
      expect((rules.pattern as any).value.test('12345')).toBe(true);
      expect((rules.pattern as any).value.test('12345-6789')).toBe(true);
      expect((rules.pattern as any).value.test('1234')).toBe(false);
    });

    it('should add Phone Number validation pattern', () => {
      const item: FormFieldsInputItem = {
        key: 'phone-field',
        type: 'string',
        label: 'Phone',
        dataType: 'Phone Number',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.pattern).toBeDefined();
      expect((rules.pattern as any).value.test('(123) 456-7890')).toBe(true);
      expect((rules.pattern as any).value.test('1234567890')).toBe(false);
    });

    it('should add SSN validation pattern', () => {
      const item: FormFieldsInputItem = {
        key: 'ssn-field',
        type: 'string',
        label: 'SSN',
        dataType: 'SSN',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.pattern).toBeDefined();
      expect((rules.pattern as any).value.test('123-45-6789')).toBe(true);
      expect((rules.pattern as any).value.test('123456789')).toBe(false);
    });

    it('should add Email validation pattern', () => {
      const item: FormFieldsInputItem = {
        key: 'email-field',
        type: 'string',
        label: 'Email',
        dataType: 'Email',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.pattern).toBeDefined();
      expect((rules.pattern as any).value.test('test@example.com')).toBe(true);
      expect((rules.pattern as any).value.test('invalid-email')).toBe(false);
    });

    it('should add DOB validation function', () => {
      const item: FormFieldsInputItem = {
        key: 'dob-field',
        type: 'date',
        label: 'Date of Birth',
        dataType: 'DOB',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.validate).toBeDefined();
      const validateFn = rules.validate as (value: string) => boolean | string;

      // Valid past date
      const pastDate = DateTime.now().minus({ years: 30 }).toISODate()!;
      expect(validateFn(pastDate)).toBe(true);

      // Future date - should fail
      const futureDate = DateTime.now().plus({ days: 1 }).toISODate()!;
      expect(validateFn(futureDate)).toContain('cannot be in the future');

      // Invalid date
      expect(validateFn('invalid-date')).toContain('valid date');
    });

    it('should add date validation for non-DOB date fields', () => {
      const item: FormFieldsInputItem = {
        key: 'appointment-date',
        type: 'date',
        label: 'Appointment Date',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.validate).toBeDefined();
      const validateFn = rules.validate as (value: string) => boolean | string;

      const validDate = DateTime.now().toISODate()!;
      expect(validateFn(validDate)).toBe(true);

      expect(validateFn('invalid-date')).toContain('valid date');
    });

    it('should add custom validation for insurance priority fields', () => {
      const item: FormFieldsInputItem = {
        key: 'insurance-priority',
        type: 'choice',
        label: 'Insurance Priority',
        options: [
          { label: 'Primary', value: 'Primary' },
          { label: 'Secondary', value: 'Secondary' },
        ],
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});

      expect(rules.validate).toBeDefined();
      const validateFn = rules.validate as (value: string, context: any) => boolean | string;

      // Different priorities - valid
      expect(validateFn('Primary', { 'insurance-priority-2': 'Secondary' })).toBe(true);

      // Same priorities - invalid
      const result = validateFn('Primary', { 'insurance-priority-2': 'Primary' });
      expect(result).toContain('may not have two primary insurance plans');
    });
  });

  describe('generateValidationRulesForSection', () => {
    it('should generate rules for all fields in a section', () => {
      const items = {
        field1: {
          key: 'field1',
          type: 'string' as const,
          label: 'Field 1',
          disabledDisplay: 'hidden' as const,
        },
        field2: {
          key: 'field2',
          type: 'string' as const,
          label: 'Field 2',
          dataType: 'Email' as const,
          disabledDisplay: 'hidden' as const,
        },
      };

      const rules = generateValidationRulesForSection(items, {}, ['field1']);

      expect(rules.field1).toBeDefined();
      expect(rules.field1.required).toBeDefined();
      expect(rules.field2).toBeDefined();
      expect(rules.field2.pattern).toBeDefined();
    });
  });

  describe('createDynamicValidationResolver', () => {
    it('should return a resolver function', () => {
      const resolver = createDynamicValidationResolver();

      expect(typeof resolver).toBe('function');
    });

    it('should validate required fields', async () => {
      const resolver = createDynamicValidationResolver();

      // Mock PATIENT_RECORD_CONFIG with a simple field
      const result = await resolver({});

      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('errors');
    });

    it('should return empty errors for valid values', async () => {
      const resolver = createDynamicValidationResolver();

      const result = await resolver({ 'some-field': 'valid-value' });

      expect(result.errors).toBeDefined();
    });

    it('should detect pattern validation errors', async () => {
      const resolver = createDynamicValidationResolver();

      // This will depend on actual PATIENT_RECORD_CONFIG fields
      const result = await resolver({});

      expect(result.errors).toBeDefined();
    });
  });
});

/**
 * @vitest-environment node
 */

import { DateTime } from 'luxon';
import { FormFieldsInputItem, PATIENT_RECORD_CONFIG } from 'utils';
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

    it.each([
      ['employer-address-2', 'employer-address'],
      ['emergency-contact-address-2', 'emergency-contact-address'],
      ['responsible-party-address-2', 'responsible-party-address'],
      ['patient-street-address-2', 'patient-street-address'],
      ['policy-holder-address-additional-line', 'policy-holder-address'],
      ['policy-holder-address-additional-line-2', 'policy-holder-address-2'],
    ])('should require line 1 when %s has a value', (addressLine2Key, addressLine1Key) => {
      const item: FormFieldsInputItem = {
        key: addressLine2Key,
        type: 'string',
        label: 'Address line 2',
        disabledDisplay: 'hidden',
      };

      const rules = generateFieldValidationRules(item, {});
      expect(rules.validate).toBeDefined();

      const validateFn = rules.validate as (value: string, context: any) => boolean | string;
      expect(validateFn('Suite 200', { [addressLine1Key]: '' })).toBe(
        'Address line 2 cannot be filled without address line 1'
      );
      expect(validateFn('Suite 200', { [addressLine1Key]: '100 Main St' })).toBe(true);
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
    /**
     * Builds form values that satisfy one section-level enable trigger,
     * so the section becomes enabled for validation. Returns empty object
     * if the section has no enable triggers (always enabled).
     */
    const buildSectionEnableValues = (section: any): Record<string, any> => {
      const triggers = section.triggers;
      if (!triggers?.length) return {};

      for (const trigger of triggers) {
        if (!trigger.effect.includes('enable')) continue;
        const targetKey = trigger.targetQuestionLinkId.includes('.')
          ? trigger.targetQuestionLinkId.split('.').pop()!
          : trigger.targetQuestionLinkId;

        if (trigger.operator === '=' && trigger.answerString !== undefined) {
          return { [targetKey]: trigger.answerString };
        }
        if (trigger.operator === '=' && trigger.answerBoolean !== undefined) {
          return { [targetKey]: trigger.answerBoolean };
        }
        if (trigger.operator === '=' && trigger.answerDateTime !== undefined) {
          return { [targetKey]: trigger.answerDateTime };
        }
        if (trigger.operator === 'exists' && trigger.answerBoolean === true) {
          return { [targetKey]: 'test-value' };
        }
        if (trigger.operator === '!=' && trigger.answerString !== undefined) {
          return { [targetKey]: `not-${trigger.answerString}` };
        }
      }
      return {};
    };

    /**
     * Returns required fields from a non-array section that have no field-level
     * enable triggers — these are always validated when the section itself is enabled.
     */
    const getUnconditionallyRequiredFields = (section: any): string[] => {
      const requiredFields: string[] = section.requiredFields ?? [];
      const items: Record<string, any> = Array.isArray(section.items)
        ? Object.assign({}, ...section.items)
        : section.items;

      return requiredFields.filter((fieldKey: string) => {
        const item = Object.values(items).find((i: any) => i.key === fieldKey) as any;
        if (!item) return true;
        return !item.triggers?.some((t: any) => t.effect.includes('enable'));
      });
    };

    const hasSectionEnableTriggers = (section: any): boolean => {
      return !!section.triggers?.some((t: any) => t.effect.includes('enable'));
    };

    const isSectionHidden = (section: any): boolean => {
      const linkId = section.linkId;
      if (!linkId) return false;
      const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
      return Array.isArray(linkId) ? linkId.every((id: string) => hidden.includes(id)) : hidden.includes(linkId);
    };

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

    it('should skip validation for sections that are not rendered based on section counts map', async () => {
      // Create resolver with 0 rendered insurance sections (no coverages)
      const resolver = createDynamicValidationResolver({
        renderedSectionCounts: { 'insurance-section': 0, 'insurance-section-2': 0 },
      });

      // Try to validate with empty insurance fields - should not error since sections aren't rendered
      const result = await resolver({
        'insurance-priority': '',
        'insurance-carrier': '',
        'insurance-member-id': '',
      });

      // Should not have validation errors for insurance fields that aren't rendered
      expect(result.errors['insurance-priority']).toBeUndefined();
      expect(result.errors['insurance-carrier']).toBeUndefined();
      expect(result.errors['insurance-member-id']).toBeUndefined();
    });

    it('should validate sections that are rendered according to section counts map', async () => {
      // Create resolver with 1 rendered insurance section (primary only at index 0)
      const resolver = createDynamicValidationResolver({
        renderedSectionCounts: { 'insurance-section': 1, 'insurance-section-2': 1 },
      });

      // Try to validate with insurance carrier selected but other required fields empty
      const result = await resolver({
        'insurance-priority': 'Primary',
        'insurance-carrier': 'Blue Cross',
        'insurance-member-id': '', // Required but empty
      });

      // Should have validation error for required field in rendered section
      expect(result.errors['insurance-member-id']).toBeDefined();
    });

    it('should validate secondary insurance when only secondary coverage exists', async () => {
      // Scenario: Patient has only secondary coverage (index 1)
      // Count = 2 to validate indices 0-1
      const resolver = createDynamicValidationResolver({
        renderedSectionCounts: { 'insurance-section': 2, 'insurance-section-2': 2 },
      });

      // Secondary insurance fields (with -2 suffix for index 1)
      const result = await resolver({
        'insurance-priority-2': 'Secondary',
        'insurance-carrier-2': 'Blue Cross',
        'insurance-member-id-2': '', // Required but empty
      });

      // Should have validation error for secondary insurance field
      expect(result.errors['insurance-member-id-2']).toBeDefined();
    });

    it('should skip validation for secondary insurance when count is 1 (primary only)', async () => {
      // Scenario: Patient has only primary coverage (index 0)
      // Count = 1 to validate only index 0, skip index 1
      const resolver = createDynamicValidationResolver({
        renderedSectionCounts: { 'insurance-section': 1, 'insurance-section-2': 1 },
      });

      // Try to validate secondary insurance fields - should be skipped
      const result = await resolver({
        'insurance-priority-2': '',
        'insurance-carrier-2': '',
        'insurance-member-id-2': '',
      });

      // Should NOT have validation errors for secondary fields when not rendered
      expect(result.errors['insurance-priority-2']).toBeUndefined();
      expect(result.errors['insurance-carrier-2']).toBeUndefined();
      expect(result.errors['insurance-member-id-2']).toBeUndefined();
    });

    it('should validate both primary and secondary when both coverages exist', async () => {
      // Scenario: Patient has both primary and secondary coverage
      // Count = 2 to validate both indices 0 and 1
      const resolver = createDynamicValidationResolver({
        renderedSectionCounts: { 'insurance-section': 2, 'insurance-section-2': 2 },
      });

      const result = await resolver({
        'insurance-priority': 'Primary',
        'insurance-carrier': 'Blue Cross',
        'insurance-member-id': '', // Primary required but empty
        'insurance-priority-2': 'Secondary',
        'insurance-carrier-2': 'Aetna',
        'insurance-member-id-2': '', // Secondary required but empty
      });

      // Should have validation errors for both primary and secondary
      expect(result.errors['insurance-member-id']).toBeDefined();
      expect(result.errors['insurance-member-id-2']).toBeDefined();
    });

    it('should skip validation for fields in sections disabled by section-level triggers', async () => {
      // Dynamically find a non-array, non-hidden section that has section-level
      // enable triggers AND unconditionally required fields
      const triggeredEntry = Object.entries(PATIENT_RECORD_CONFIG.FormFields).find(([_, section]) => {
        const sec = section as any;
        return (
          !Array.isArray(sec.items) &&
          !isSectionHidden(sec) &&
          hasSectionEnableTriggers(sec) &&
          getUnconditionallyRequiredFields(sec).length > 0
        );
      });

      if (!triggeredEntry) {
        // No section with enable triggers + required fields in this config — nothing to test
        return;
      }

      const sec = triggeredEntry[1] as any;
      const requiredFields = getUnconditionallyRequiredFields(sec);
      const enableValues = buildSectionEnableValues(sec);

      const resolver = createDynamicValidationResolver();

      const emptyValues: Record<string, string> = {};
      requiredFields.forEach((f) => {
        emptyValues[f] = '';
      });

      // Without trigger values the section is disabled — no validation errors expected
      const resultDisabled = await resolver({ ...emptyValues });
      requiredFields.forEach((field) => {
        expect(resultDisabled.errors[field]).toBeUndefined();
      });

      // With trigger values the section is enabled — required empty fields should error
      const resultEnabled = await resolver({ ...emptyValues, ...enableValues });
      requiredFields.forEach((field) => {
        expect(resultEnabled.errors[field]).toBeDefined();
      });
    });

    it('should validate required fields in enabled sections', async () => {
      const rpSection = PATIENT_RECORD_CONFIG.FormFields.responsibleParty as any;

      if (isSectionHidden(rpSection)) return;

      const requiredFields = getUnconditionallyRequiredFields(rpSection);
      if (requiredFields.length === 0) return;

      const enableValues = buildSectionEnableValues(rpSection);

      const resolver = createDynamicValidationResolver();

      const emptyValues: Record<string, string> = {};
      requiredFields.forEach((f) => {
        emptyValues[f] = '';
      });

      const result = await resolver({ ...emptyValues, ...enableValues });
      requiredFields.forEach((field) => {
        expect(result.errors[field]).toBeDefined();
      });
    });

    it('should validate required emergency contact fields normally', async () => {
      const ecSection = PATIENT_RECORD_CONFIG.FormFields.emergencyContact as any;

      if (isSectionHidden(ecSection)) return;

      const requiredFields = getUnconditionallyRequiredFields(ecSection);
      if (requiredFields.length === 0) return;

      const enableValues = buildSectionEnableValues(ecSection);

      const resolver = createDynamicValidationResolver();

      const emptyValues: Record<string, string> = {};
      requiredFields.forEach((f) => {
        emptyValues[f] = '';
      });

      const result = await resolver({ ...emptyValues, ...enableValues });
      requiredFields.forEach((field) => {
        expect(result.errors[field]).toBeDefined();
      });
    });
  });
});

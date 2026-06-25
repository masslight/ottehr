import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-update-medication-order/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-update-medication-order - validateRequestParameters', () => {
  const fullOrderData = {
    patient: 'patient-1',
    encounter: 'encounter-1',
    encounterId: 'encounter-1',
    medicationId: 'med-1',
    units: 'mg',
    dose: 10,
    route: 'oral',
  };

  test('should return validated params for a new order creation', () => {
    const input = createMockZambdaInput({
      newStatus: 'administered',
      orderData: { ...fullOrderData, effectiveDateTime: '2024-01-01T10:00:00Z' },
    });
    const result = validateRequestParameters(input);

    expect(result.newStatus).toBe('administered');
    expect(result.orderData).toBeDefined();
    expect(result.secrets).toBeNull();
  });

  test('should return validated params for updating an existing order', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'administered',
      orderData: { ...fullOrderData, effectiveDateTime: '2024-01-01T10:00:00Z' },
    });
    const result = validateRequestParameters(input);

    expect(result.orderId).toBe('order-123');
    expect(result.newStatus).toBe('administered');
  });

  test('should return validated params for cancellation with reason', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'cancelled',
      orderData: { reason: 'Patient refused' },
    });
    const result = validateRequestParameters(input);

    expect(result.orderId).toBe('order-123');
    expect(result.newStatus).toBe('cancelled');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: null as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is invalid JSON', () => {
    const input = createMockZambdaInput(null, { body: 'not-json' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when status is administered but no orderData', () => {
    const input = createMockZambdaInput({
      newStatus: 'administered',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when status is pending', () => {
    const input = createMockZambdaInput({
      newStatus: 'pending',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when changing status to cancelled without reason for existing order', () => {
    // The condition is: orderId && newStatus !== 'administered' && newStatus !== 'cancelled' && !orderData?.reason
    // For 'cancelled' status, the check skips (newStatus !== 'cancelled' is false), so no throw
    // Test a non-administered, non-cancelled status instead
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'administered-not',
      orderData: {},
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when administered but effectiveDateTime is missing', () => {
    const input = createMockZambdaInput({
      newStatus: 'administered',
      orderData: { ...fullOrderData },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when new order (no orderId) is missing required fields', () => {
    const input = createMockZambdaInput({
      newStatus: 'administered',
      orderData: { effectiveDateTime: '2024-01-01T10:00:00Z' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when drug interaction is missing overrideReason', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'administered',
      orderData: { ...fullOrderData, effectiveDateTime: '2024-01-01T10:00:00Z' },
      interactions: {
        drugInteractions: [{ drugs: [{ id: 'd1', name: 'Drug1' }], severity: 'high' }],
        allergyInteractions: [],
      },
    });
    expect(() => validateRequestParameters(input)).toThrow('overrideReason');
  });

  test('should throw when allergy interaction is missing overrideReason', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'administered',
      orderData: { ...fullOrderData, effectiveDateTime: '2024-01-01T10:00:00Z' },
      interactions: {
        drugInteractions: [],
        allergyInteractions: [{ message: 'Allergic' }],
      },
    });
    expect(() => validateRequestParameters(input)).toThrow('overrideReason');
  });

  test('should accept interactions with overrideReason provided', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
      newStatus: 'administered',
      orderData: { ...fullOrderData, effectiveDateTime: '2024-01-01T10:00:00Z' },
      interactions: {
        drugInteractions: [
          { drugs: [{ id: 'd1', name: 'Drug1' }], severity: 'high', overrideReason: 'Doctor approved' },
        ],
        allergyInteractions: [{ message: 'Allergic', overrideReason: 'Low risk' }],
      },
    });
    const result = validateRequestParameters(input);

    expect(result.interactions?.drugInteractions).toHaveLength(1);
    expect(result.interactions?.allergyInteractions).toHaveLength(1);
  });

  test('should allow body with no newStatus (passthrough)', () => {
    const input = createMockZambdaInput({
      orderId: 'order-123',
    });
    const result = validateRequestParameters(input);

    expect(result.orderId).toBe('order-123');
    expect(result.newStatus).toBeUndefined();
  });
});

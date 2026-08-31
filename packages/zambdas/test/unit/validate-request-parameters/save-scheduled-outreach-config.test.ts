import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/scheduled-outreach-config/save-scheduled-outreach-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const validSendNotificationAction = {
  id: 'action-1',
  trigger: { event: 'invoice-due', daysAfter: 7 },
  actionType: 'send-notification',
  sendNotificationConfig: {
    mediums: ['sms'],
    smsTemplate: 'Your invoice is due.',
    emailTemplate: '',
  },
};

const validChargeCardAction = {
  id: 'action-2',
  trigger: { event: 'invoice-due', daysAfter: 14 },
  actionType: 'charge-card',
  chargeCardConfig: {
    retryAttempts: 0,
    retryIntervalDays: 0,
    onSuccess: { enabled: true, mediums: ['sms'], smsTemplate: 'Charged!', emailTemplate: '' },
    onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
  },
};

describe('save-scheduled-outreach-config - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for an empty actions array', () => {
    const input = createMockZambdaInput({ actions: [] }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.actions).toEqual([]);
    expect(result.notificationsTimeRestriction).toBeUndefined();
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params for a valid send-notification action', () => {
    const input = createMockZambdaInput({ actions: [validSendNotificationAction] }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('action-1');
  });

  test('should return validated params for a valid charge-card action', () => {
    const input = createMockZambdaInput({ actions: [validChargeCardAction] }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionType).toBe('charge-card');
  });

  test('should validate notificationsTimeRestriction when provided', () => {
    const input = createMockZambdaInput(
      {
        actions: [],
        notificationsTimeRestriction: {
          enabled: true,
          windowStart: '09:00',
          windowEnd: '21:00',
          timezone: 'America/New_York',
        },
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.notificationsTimeRestriction).toEqual({
      enabled: true,
      windowStart: '09:00',
      windowEnd: '21:00',
      timezone: 'America/New_York',
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput({ actions: [] }, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when actions is not an array', () => {
    const input = createMockZambdaInput({ actions: 'not-an-array' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when actions is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when an action has invalid actionType', () => {
    const invalidAction = { ...validSendNotificationAction, actionType: 'invalid-type' };
    const input = createMockZambdaInput({ actions: [invalidAction] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when an action has invalid trigger event', () => {
    const invalidAction = {
      ...validSendNotificationAction,
      trigger: { event: 'invalid-event', daysAfter: 7 },
    };
    const input = createMockZambdaInput({ actions: [invalidAction] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a send-notification action is missing sendNotificationConfig', () => {
    const invalidAction = {
      id: 'action-x',
      trigger: { event: 'invoice-due', daysAfter: 7 },
      actionType: 'send-notification',
    };
    const input = createMockZambdaInput({ actions: [invalidAction] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when notificationsTimeRestriction has invalid windowStart format', () => {
    const input = createMockZambdaInput(
      {
        actions: [],
        notificationsTimeRestriction: {
          enabled: true,
          windowStart: '9:00',
          windowEnd: '21:00',
          timezone: 'America/New_York',
        },
      },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when notificationsTimeRestriction.timezone is empty', () => {
    const input = createMockZambdaInput(
      {
        actions: [],
        notificationsTimeRestriction: {
          enabled: true,
          windowStart: '09:00',
          windowEnd: '21:00',
          timezone: '',
        },
      },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});

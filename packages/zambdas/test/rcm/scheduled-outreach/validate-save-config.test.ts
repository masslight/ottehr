import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/scheduled-outreach-config/save-scheduled-outreach-config/validateRequestParameters';
import type { ZambdaInput } from '../../../src/shared/types/common';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: { test: 'secret' } };
}

function validSendNotificationAction(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'action-1',
    trigger: { event: 'invoice-due', daysAfter: 7 },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms'],
      smsTemplate: 'Hello',
      emailTemplate: '',
    },
    ...overrides,
  };
}

function validChargeCardAction(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'charge-1',
    trigger: { event: 'invoice-due', daysAfter: 14 },
    actionType: 'charge-card',
    chargeCardConfig: {
      retryAttempts: 2,
      retryIntervalDays: 3,
      onSuccess: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
      onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
    },
    ...overrides,
  };
}

function validReferToCollectionsAction(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'collections-1',
    trigger: { event: 'invoice-due', daysAfter: 90 },
    actionType: 'refer-to-collections',
    referToCollectionsConfig: {
      agency: 'IC System',
      minimumBalance: 50,
      includePaymentHistory: true,
    },
    ...overrides,
  };
}

function validLogAction(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'log-1',
    trigger: { event: 'discharge-time', daysAfter: 0 },
    actionType: 'log',
    ...overrides,
  };
}

describe('save-scheduled-outreach-config validateRequestParameters', () => {
  it('accepts valid send-notification action', () => {
    const result = validateRequestParameters(makeInput({ actions: [validSendNotificationAction()] }));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionType).toBe('send-notification');
  });

  it('accepts valid charge-card action', () => {
    const result = validateRequestParameters(makeInput({ actions: [validChargeCardAction()] }));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionType).toBe('charge-card');
  });

  it('accepts valid refer-to-collections action', () => {
    const result = validateRequestParameters(makeInput({ actions: [validReferToCollectionsAction()] }));
    expect(result.actions).toHaveLength(1);
  });

  it('accepts valid log action', () => {
    const result = validateRequestParameters(makeInput({ actions: [validLogAction()] }));
    expect(result.actions).toHaveLength(1);
  });

  it('accepts empty actions array', () => {
    const result = validateRequestParameters(makeInput({ actions: [] }));
    expect(result.actions).toEqual([]);
  });

  it('accepts valid notificationsTimeRestriction', () => {
    const result = validateRequestParameters(
      makeInput({
        actions: [],
        notificationsTimeRestriction: {
          enabled: true,
          windowStart: '09:00',
          windowEnd: '21:00',
          timezone: 'America/New_York',
        },
      })
    );
    expect(result.notificationsTimeRestriction).toBeDefined();
    expect(result.notificationsTimeRestriction!.enabled).toBe(true);
  });

  it('accepts action with optional timeUnit and direction', () => {
    const result = validateRequestParameters(
      makeInput({
        actions: [
          validSendNotificationAction({
            trigger: { event: 'invoice-due', daysAfter: 2, timeUnit: 'hours', direction: 'before' },
          }),
        ],
      })
    );
    expect(result.actions[0].trigger.timeUnit).toBe('hours');
    expect(result.actions[0].trigger.direction).toBe('before');
  });

  it('accepts action with birthdayConfig', () => {
    const result = validateRequestParameters(
      makeInput({
        actions: [
          validSendNotificationAction({
            trigger: { event: 'patient-birthday', daysAfter: 0 },
            birthdayConfig: { ageMode: 'at', age: 18 },
          }),
        ],
      })
    );
    expect(result.actions[0].birthdayConfig).toBeDefined();
  });

  // ── Error cases ───────────────────────────────────────────────────────

  it('throws when body is missing', () => {
    const input: ZambdaInput = { headers: null, body: null, secrets: { test: 'secret' } };
    expect(() => validateRequestParameters(input)).toThrow('The request was missing a required request body');
  });

  it('throws when secrets are missing', () => {
    const input: ZambdaInput = { headers: null, body: JSON.stringify({ actions: [] }), secrets: null };
    expect(() => validateRequestParameters(input)).toThrow('The request was missing secrets required to process it');
  });

  it('throws when actions is not an array', () => {
    expect(() => validateRequestParameters(makeInput({ actions: 'not-an-array' }))).toThrow(
      'Validation error: Expected array, received string at "actions"'
    );
  });

  it('throws when action has no id', () => {
    expect(() =>
      validateRequestParameters(makeInput({ actions: [{ ...validSendNotificationAction(), id: '' }] }))
    ).toThrow('actions[0].id must be a non-empty string');
  });

  it('throws when trigger is missing', () => {
    const action = { ...validSendNotificationAction() };
    delete (action as any).trigger;
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      'The following required parameters were missing: actions[0].trigger'
    );
  });

  it('throws on invalid trigger event', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({ actions: [validSendNotificationAction({ trigger: { event: 'invalid-event', daysAfter: 0 } })] })
      )
    ).toThrow(
      'actions[0].trigger.event must be one of: date-of-visit, invoice-issued, invoice-due, discharge-time, patient-birthday'
    );
  });

  it('throws when daysAfter is negative', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({ actions: [validSendNotificationAction({ trigger: { event: 'invoice-due', daysAfter: -1 } })] })
      )
    ).toThrow('actions[0].trigger.daysAfter must be a non-negative number');
  });

  it('throws on invalid actionType', () => {
    expect(() =>
      validateRequestParameters(makeInput({ actions: [validSendNotificationAction({ actionType: 'invalid' })] }))
    ).toThrow('actions[0].actionType must be one of: charge-card, send-notification, refer-to-collections, log');
  });

  it('throws when discharge-time trigger has charge-card actionType', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            {
              ...validChargeCardAction(),
              trigger: { event: 'discharge-time', daysAfter: 0 },
            },
          ],
        })
      )
    ).toThrow("actionType must be 'send-notification' or 'log'");
  });

  it('throws when patient-birthday trigger has refer-to-collections actionType', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            {
              ...validReferToCollectionsAction(),
              trigger: { event: 'patient-birthday', daysAfter: 0 },
            },
          ],
        })
      )
    ).toThrow("actionType must be 'send-notification' or 'log'");
  });

  it('throws when charge-card is missing chargeCardConfig', () => {
    const action = validChargeCardAction();
    delete (action as any).chargeCardConfig;
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      'The following required parameters were missing: actions[0].chargeCardConfig'
    );
  });

  it('throws when charge-card retryAttempts is negative', () => {
    const action = validChargeCardAction({
      chargeCardConfig: {
        retryAttempts: -1,
        retryIntervalDays: 3,
        onSuccess: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
        onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
      },
    });
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      /retryAttempts must be a non-negative number/
    );
  });

  it('throws when charge-card retryIntervalDays is less than 1', () => {
    const action = validChargeCardAction({
      chargeCardConfig: {
        retryAttempts: 1,
        retryIntervalDays: 0,
        onSuccess: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
        onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
      },
    });
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      /retryIntervalDays must be a positive number/
    );
  });

  it('throws when send-notification is missing sendNotificationConfig', () => {
    const action = validSendNotificationAction();
    delete (action as any).sendNotificationConfig;
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      'The following required parameters were missing: actions[0].sendNotificationConfig'
    );
  });

  it('throws when send-notification mediums is empty', () => {
    const action = validSendNotificationAction({
      sendNotificationConfig: { mediums: [], smsTemplate: '', emailTemplate: '' },
    });
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      /mediums must be a non-empty array/
    );
  });

  it('throws when send-notification has invalid medium', () => {
    const action = validSendNotificationAction({
      sendNotificationConfig: { mediums: ['carrier-pigeon'], smsTemplate: '', emailTemplate: '' },
    });
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      'actions[0].sendNotificationConfig.mediums contains invalid value: carrier-pigeon'
    );
  });

  it('throws when refer-to-collections is missing referToCollectionsConfig', () => {
    const action = validReferToCollectionsAction();
    delete (action as any).referToCollectionsConfig;
    expect(() => validateRequestParameters(makeInput({ actions: [action] }))).toThrow(
      'The following required parameters were missing: actions[0].referToCollectionsConfig'
    );
  });

  it('throws on invalid timeUnit', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            validSendNotificationAction({ trigger: { event: 'invoice-due', daysAfter: 1, timeUnit: 'weeks' } }),
          ],
        })
      )
    ).toThrow('actions[0].trigger.timeUnit must be one of: days, hours, minutes');
  });

  it('throws on invalid direction', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            validSendNotificationAction({ trigger: { event: 'invoice-due', daysAfter: 1, direction: 'sideways' } }),
          ],
        })
      )
    ).toThrow('actions[0].trigger.direction must be one of: after, before');
  });

  it('throws when notificationsTimeRestriction.windowStart has invalid format', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [],
          notificationsTimeRestriction: {
            enabled: true,
            windowStart: '9am',
            windowEnd: '21:00',
            timezone: 'America/New_York',
          },
        })
      )
    ).toThrow('notificationsTimeRestriction.windowStart must be a time string (HH:mm)');
  });

  it('throws when notificationsTimeRestriction.timezone is empty', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [],
          notificationsTimeRestriction: {
            enabled: true,
            windowStart: '09:00',
            windowEnd: '21:00',
            timezone: '',
          },
        })
      )
    ).toThrow('notificationsTimeRestriction.timezone must be a non-empty string');
  });

  it('throws on invalid birthdayConfig.ageMode', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            validSendNotificationAction({
              trigger: { event: 'patient-birthday', daysAfter: 0 },
              birthdayConfig: { ageMode: 'before', age: 18 },
            }),
          ],
        })
      )
    ).toThrow("ageMode must be 'at' or 'after'");
  });

  it('throws on invalid birthdayConfig.age', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            validSendNotificationAction({
              trigger: { event: 'patient-birthday', daysAfter: 0 },
              birthdayConfig: { ageMode: 'at', age: 0 },
            }),
          ],
        })
      )
    ).toThrow('actions[0].birthdayConfig.age must be a number between 1 and 150');
  });

  it('throws on invalid statement type', () => {
    expect(() =>
      validateRequestParameters(
        makeInput({
          actions: [
            validSendNotificationAction({
              sendNotificationConfig: {
                mediums: ['paper-mail'],
                smsTemplate: '',
                emailTemplate: '',
                statementType: 'invalid-type',
              },
            }),
          ],
        })
      )
    ).toThrow('actions[0].sendNotificationConfig.statementType must be one of: standard, past-due, final-notice');
  });
});

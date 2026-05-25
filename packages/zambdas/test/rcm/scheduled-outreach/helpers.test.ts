import { PlanDefinition } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  buildPlanDefinitionFromActions,
  NotificationsTimeRestriction,
  OutreachAction,
  parseNotificationsTimeRestriction,
  parsePlanDefinitionToActions,
} from '../../../src/rcm/scheduled-outreach-config/helpers';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSendNotificationAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'action-1',
    trigger: { event: 'invoice-due', daysAfter: 7, timeUnit: 'days', direction: 'after' },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms', 'email'],
      smsTemplate: 'Hello {{patient-first-name}}, your balance is due.',
      emailTemplate: '<p>Dear {{patient-first-name}}, please pay your balance.</p>',
    },
    ...overrides,
  };
}

function makeChargeCardAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'charge-1',
    trigger: { event: 'invoice-due', daysAfter: 14, timeUnit: 'days', direction: 'after' },
    actionType: 'charge-card',
    chargeCardConfig: {
      retryAttempts: 3,
      retryIntervalDays: 2,
      onSuccess: {
        enabled: true,
        mediums: ['sms'],
        smsTemplate: 'Payment processed!',
        emailTemplate: '',
      },
      onFailure: {
        enabled: true,
        mediums: ['email'],
        smsTemplate: '',
        emailTemplate: '<p>Your payment failed.</p>',
      },
    },
    ...overrides,
  };
}

function makeReferToCollectionsAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'collections-1',
    trigger: { event: 'invoice-due', daysAfter: 90, timeUnit: 'days', direction: 'after' },
    actionType: 'refer-to-collections',
    referToCollectionsConfig: {
      agency: 'IC System',
      minimumBalance: 50,
      includePaymentHistory: true,
    },
    ...overrides,
  };
}

function makeLogAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'log-1',
    trigger: { event: 'discharge-time', daysAfter: 0 },
    actionType: 'log',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('scheduled-outreach-config helpers', () => {
  describe('parsePlanDefinitionToActions / buildPlanDefinitionFromActions round-trip', () => {
    it('round-trips a send-notification action', () => {
      const original = [makeSendNotificationAction()];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('action-1');
      expect(parsed[0].actionType).toBe('send-notification');
      expect(parsed[0].trigger.event).toBe('invoice-due');
      expect(parsed[0].trigger.daysAfter).toBe(7);
      expect(parsed[0].trigger.timeUnit).toBe('days');
      expect(parsed[0].trigger.direction).toBe('after');
      expect(parsed[0].sendNotificationConfig?.mediums).toEqual(['sms', 'email']);
      expect(parsed[0].sendNotificationConfig?.smsTemplate).toBe('Hello {{patient-first-name}}, your balance is due.');
      expect(parsed[0].sendNotificationConfig?.emailTemplate).toBe(
        '<p>Dear {{patient-first-name}}, please pay your balance.</p>'
      );
    });

    it('round-trips a charge-card action', () => {
      const original = [makeChargeCardAction()];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('charge-1');
      expect(parsed[0].actionType).toBe('charge-card');
      expect(parsed[0].chargeCardConfig?.retryAttempts).toBe(3);
      expect(parsed[0].chargeCardConfig?.retryIntervalDays).toBe(2);
      expect(parsed[0].chargeCardConfig?.onSuccess.enabled).toBe(true);
      expect(parsed[0].chargeCardConfig?.onSuccess.mediums).toEqual(['sms']);
      expect(parsed[0].chargeCardConfig?.onSuccess.smsTemplate).toBe('Payment processed!');
      expect(parsed[0].chargeCardConfig?.onFailure.enabled).toBe(true);
      expect(parsed[0].chargeCardConfig?.onFailure.mediums).toEqual(['email']);
      expect(parsed[0].chargeCardConfig?.onFailure.emailTemplate).toBe('<p>Your payment failed.</p>');
    });

    it('round-trips a refer-to-collections action', () => {
      const original = [makeReferToCollectionsAction()];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('collections-1');
      expect(parsed[0].actionType).toBe('refer-to-collections');
      expect(parsed[0].referToCollectionsConfig?.agency).toBe('IC System');
      expect(parsed[0].referToCollectionsConfig?.minimumBalance).toBe(50);
      expect(parsed[0].referToCollectionsConfig?.includePaymentHistory).toBe(true);
    });

    it('round-trips a log action', () => {
      const original = [makeLogAction()];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('log-1');
      expect(parsed[0].actionType).toBe('log');
      expect(parsed[0].trigger.event).toBe('discharge-time');
      expect(parsed[0].trigger.daysAfter).toBe(0);
    });

    it('round-trips multiple actions of different types', () => {
      const original = [
        makeSendNotificationAction({ id: 'a1' }),
        makeChargeCardAction({ id: 'a2' }),
        makeReferToCollectionsAction({ id: 'a3' }),
        makeLogAction({ id: 'a4' }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed).toHaveLength(4);
      expect(parsed.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
      expect(parsed.map((a) => a.actionType)).toEqual([
        'send-notification',
        'charge-card',
        'refer-to-collections',
        'log',
      ]);
    });

    it('round-trips action with "before" direction', () => {
      const original = [
        makeSendNotificationAction({
          id: 'before-1',
          trigger: { event: 'patient-birthday', daysAfter: 3, timeUnit: 'days', direction: 'before' },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].trigger.direction).toBe('before');
      expect(parsed[0].trigger.daysAfter).toBe(3);
    });

    it('round-trips action with hours time unit', () => {
      const original = [
        makeSendNotificationAction({
          id: 'hours-1',
          trigger: { event: 'discharge-time', daysAfter: 2, timeUnit: 'hours', direction: 'after' },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].trigger.timeUnit).toBe('hours');
      expect(parsed[0].trigger.daysAfter).toBe(2);
    });

    it('round-trips action with minutes time unit', () => {
      const original = [
        makeSendNotificationAction({
          id: 'min-1',
          trigger: { event: 'discharge-time', daysAfter: 30, timeUnit: 'minutes', direction: 'after' },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].trigger.timeUnit).toBe('minutes');
      expect(parsed[0].trigger.daysAfter).toBe(30);
    });

    it('round-trips send-notification action with paper-mail medium and statement type', () => {
      const original = [
        makeSendNotificationAction({
          id: 'paper-1',
          sendNotificationConfig: {
            mediums: ['paper-mail'],
            smsTemplate: '',
            emailTemplate: '',
            statementType: 'past-due',
          },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].sendNotificationConfig?.mediums).toEqual(['paper-mail']);
      expect(parsed[0].sendNotificationConfig?.statementType).toBe('past-due');
    });

    it('round-trips birthday config with age-mode "at"', () => {
      const original = [
        makeSendNotificationAction({
          id: 'bday-at',
          trigger: { event: 'patient-birthday', daysAfter: 0 },
          birthdayConfig: { ageMode: 'at', age: 18 },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].birthdayConfig?.ageMode).toBe('at');
      expect(parsed[0].birthdayConfig?.age).toBe(18);
    });

    it('round-trips birthday config with age-mode "after" and maxAge', () => {
      const original = [
        makeLogAction({
          id: 'bday-after',
          trigger: { event: 'patient-birthday', daysAfter: 0 },
          birthdayConfig: { ageMode: 'after', age: 13, maxAge: 17 },
        }),
      ];
      const planDef = buildPlanDefinitionFromActions(original) as PlanDefinition;
      const parsed = parsePlanDefinitionToActions(planDef);

      expect(parsed[0].birthdayConfig?.ageMode).toBe('after');
      expect(parsed[0].birthdayConfig?.age).toBe(13);
      expect(parsed[0].birthdayConfig?.maxAge).toBe(17);
    });

    it('returns empty array when PlanDefinition has no actions', () => {
      const planDef: PlanDefinition = {
        resourceType: 'PlanDefinition',
        status: 'active',
      };
      expect(parsePlanDefinitionToActions(planDef)).toEqual([]);
    });
  });

  describe('parseNotificationsTimeRestriction', () => {
    it('returns defaults when no extension is present', () => {
      const planDef: PlanDefinition = { resourceType: 'PlanDefinition', status: 'active' };
      const result = parseNotificationsTimeRestriction(planDef);

      expect(result).toEqual({
        enabled: false,
        windowStart: '09:00',
        windowEnd: '21:00',
        timezone: 'America/New_York',
      });
    });

    it('round-trips a time restriction through build/parse', () => {
      const restriction: NotificationsTimeRestriction = {
        enabled: true,
        windowStart: '08:00',
        windowEnd: '20:00',
        timezone: 'America/Chicago',
      };

      const planDef = buildPlanDefinitionFromActions([], restriction) as PlanDefinition;
      const parsed = parseNotificationsTimeRestriction(planDef);

      expect(parsed.enabled).toBe(true);
      expect(parsed.windowStart).toBe('08:00');
      expect(parsed.windowEnd).toBe('20:00');
      expect(parsed.timezone).toBe('America/Chicago');
    });
  });

  describe('buildPlanDefinitionFromActions structure', () => {
    it('produces a valid PlanDefinition resource', () => {
      const actions = [makeSendNotificationAction()];
      const planDef = buildPlanDefinitionFromActions(actions);

      expect(planDef.resourceType).toBe('PlanDefinition');
      expect(planDef.status).toBe('active');
      expect(planDef.name).toBe('ScheduledPatientOutreachWorkflow');
      expect(planDef.url).toBe('https://ottehr.com/r4/PlanDefinition/scheduled-patient-outreach-workflow');
      expect(planDef.meta?.tag).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'rcm' }),
          expect.objectContaining({ code: 'scheduled-outreach-config' }),
        ])
      );
    });

    it('builds empty action array when no actions are provided', () => {
      const planDef = buildPlanDefinitionFromActions([]);
      expect(planDef.action).toEqual([]);
    });
  });
});

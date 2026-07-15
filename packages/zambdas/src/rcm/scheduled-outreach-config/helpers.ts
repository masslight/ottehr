import Oystehr from '@oystehr/sdk';
import { PlanDefinition } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { rcmMeta } from '../../shared';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;

export const OUTREACH_PLAN_DEFINITION_URL = 'https://ottehr.com/r4/PlanDefinition/scheduled-patient-outreach-workflow';

// ── UI types (mirrored from ScheduledPatientOutreach.tsx) ────────────────────────────

export type TriggerEvent = 'date-of-visit' | 'invoice-issued' | 'invoice-due' | 'discharge-time' | 'patient-birthday';
export type NotificationMedium = 'sms' | 'email' | 'paper-mail';
export type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections' | 'log';
export type TimeUnit = 'days' | 'hours' | 'minutes';
export type TriggerDirection = 'after' | 'before';

export type OutreachStatementType = 'standard' | 'past-due' | 'final-notice';

export interface NotificationConfig {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ChargeCardConfig {
  onSuccess: NotificationConfig;
  onFailure: NotificationConfig;
  retryAttempts: number;
  retryIntervalDays: number;
}

export interface SendNotificationConfig {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ReferToCollectionsConfig {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

export type BirthdayAgeMode = 'at' | 'after';

export interface BirthdayConfig {
  /** 'at' = only on this exact age; 'after' = from this age onward (up to maxAge). */
  ageMode?: BirthdayAgeMode;
  /** The target age (required when ageMode is set). */
  age?: number;
  /** Upper bound when ageMode is 'after'. Defaults to 100 if not specified. */
  maxAge?: number;
}

export interface NotificationsTimeRestriction {
  enabled: boolean;
  windowStart: string; // HH:mm
  windowEnd: string; // HH:mm
  timezone: string;
}

export interface OutreachAction {
  id: string;
  enabled?: boolean;
  trigger: {
    event: TriggerEvent;
    daysAfter: number;
    timeUnit?: TimeUnit;
    direction?: TriggerDirection;
  };
  actionType: ActionType;
  chargeCardConfig?: ChargeCardConfig;
  sendNotificationConfig?: SendNotificationConfig;
  referToCollectionsConfig?: ReferToCollectionsConfig;
  logConfig?: Record<string, never>;
  birthdayConfig?: BirthdayConfig;
}

// ── Notifications time restriction extension ───────────────────────────────

const NOTIFICATIONS_TIME_RESTRICTION_URL = `${PRIVATE_EXTENSION_BASE_URL}/notifications-time-restriction`;

function buildNotificationsTimeRestrictionExtension(
  restriction: NotificationsTimeRestriction
): PlanDefinition['extension'] {
  return [
    {
      url: NOTIFICATIONS_TIME_RESTRICTION_URL,
      extension: [
        { url: 'enabled', valueBoolean: restriction.enabled },
        { url: 'window-start', valueTime: restriction.windowStart + ':00' },
        { url: 'window-end', valueTime: restriction.windowEnd + ':00' },
        { url: 'timezone', valueString: restriction.timezone },
      ],
    },
  ];
}

export function parseNotificationsTimeRestriction(planDef: PlanDefinition): NotificationsTimeRestriction {
  const ext = planDef.extension?.find((e) => e.url === NOTIFICATIONS_TIME_RESTRICTION_URL);
  if (!ext || !ext.extension) {
    return { enabled: false, windowStart: '09:00', windowEnd: '21:00', timezone: 'America/New_York' };
  }
  const sub = ext.extension;
  const enabled = sub.find((e) => e.url === 'enabled')?.valueBoolean ?? false;
  const windowStart = (sub.find((e) => e.url === 'window-start')?.valueTime ?? '09:00:00').substring(0, 5);
  const windowEnd = (sub.find((e) => e.url === 'window-end')?.valueTime ?? '21:00:00').substring(0, 5);
  const timezone = sub.find((e) => e.url === 'timezone')?.valueString ?? 'America/New_York';
  return { enabled, windowStart, windowEnd, timezone };
}

// ── Configured-at extension (immutable activation timestamp) ────────────────

const OUTREACH_CONFIGURED_AT_URL = `${PRIVATE_EXTENSION_BASE_URL}/outreach-configured-at`;

function buildConfiguredAtExtension(configuredAtIso: string): NonNullable<PlanDefinition['extension']>[number] {
  return { url: OUTREACH_CONFIGURED_AT_URL, valueDateTime: configuredAtIso };
}

/**
 * Reads the immutable "configured at" timestamp stamped on the outreach PlanDefinition when it
 * was first created. Unlike meta.lastUpdated, this value never changes on subsequent config edits,
 * so it can be used as a stable activation date for retroactive-send guards.
 */
export function parseConfiguredAt(planDef: PlanDefinition): string | undefined {
  return planDef.extension?.find((e) => e.url === OUTREACH_CONFIGURED_AT_URL)?.valueDateTime;
}

/**
 * Returns the given extensions with the immutable configuredAt extension guaranteed present.
 * If `existing` already carries one it is preserved verbatim; otherwise it is stamped with
 * `fallbackIso` (defaults to now) so legacy configs get a stable timestamp on first re-save.
 */
export function preserveConfiguredAtExtension(
  builtExtensions: PlanDefinition['extension'],
  existing: PlanDefinition,
  fallbackIso: string = new Date().toISOString()
): PlanDefinition['extension'] {
  const configuredAtIso = parseConfiguredAt(existing) ?? fallbackIso;
  const others = (builtExtensions ?? []).filter((e) => e.url !== OUTREACH_CONFIGURED_AT_URL);
  return [...others, buildConfiguredAtExtension(configuredAtIso)];
}

// ── Action enabled extension ───────────────────────────────────────────────

const ACTION_ENABLED_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/outreach-action-enabled`;

function buildActionEnabledExtension(enabled: boolean): any {
  return { url: ACTION_ENABLED_EXTENSION_URL, valueBoolean: enabled };
}

function parseActionEnabled(fhirAction: any): boolean {
  const ext = fhirAction.extension?.find((e: any) => e.url === ACTION_ENABLED_EXTENSION_URL);
  if (!ext) return true; // default to enabled if extension is absent
  return ext.valueBoolean ?? true;
}

// ── Birthday config extension ──────────────────────────────────────────────

const BIRTHDAY_CONFIG_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/outreach-birthday-config`;

function buildBirthdayConfigExtension(config: BirthdayConfig): any {
  const extensions: any[] = [];
  if (config.ageMode) {
    extensions.push({ url: 'age-mode', valueCode: config.ageMode });
  }
  if (config.age != null) {
    extensions.push({ url: 'age', valueInteger: config.age });
  }
  if (config.maxAge != null) {
    extensions.push({ url: 'max-age', valueInteger: config.maxAge });
  }
  return { url: BIRTHDAY_CONFIG_EXTENSION_URL, extension: extensions };
}

function parseBirthdayConfig(fhirAction: any): BirthdayConfig | undefined {
  const ext = fhirAction.extension?.find((e: any) => e.url === BIRTHDAY_CONFIG_EXTENSION_URL);
  if (!ext) return undefined;
  const subs = ext.extension || [];
  const ageMode = subs.find((e: any) => e.url === 'age-mode')?.valueCode as BirthdayAgeMode | undefined;
  const age = subs.find((e: any) => e.url === 'age')?.valueInteger as number | undefined;
  const maxAge = subs.find((e: any) => e.url === 'max-age')?.valueInteger as number | undefined;
  if (!ageMode && age == null) return undefined;
  return { ageMode, age, maxAge };
}

// ── FHIR code systems ──────────────────────────────────────────────────────

const ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';
const MEDIUM_SYSTEM = 'https://ottehr.com/CodeSystem/notification-medium';
const COLLECTIONS_AGENCY_SYSTEM = 'https://ottehr.com/CodeSystem/collections-agency';

const ACTION_TYPE_DISPLAY: Record<ActionType, string> = {
  'charge-card': 'Charge Credit Card on File',
  'send-notification': 'Send Notification',
  'refer-to-collections': 'Refer to Collections',
  log: 'Log',
};

const MEDIUM_DISPLAY: Record<NotificationMedium, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail Statement',
};

// ── Conversion: UI → FHIR ─────────────────────────────────────────────────

const TIME_UNIT_TO_FHIR: Record<TimeUnit, { unit: string; code: string }> = {
  days: { unit: 'days', code: 'd' },
  hours: { unit: 'hours', code: 'h' },
  minutes: { unit: 'minutes', code: 'min' },
};

function buildOffsetDuration(trigger: OutreachAction['trigger']): any {
  const timeUnit = trigger.timeUnit || 'days';
  const fhirUnit = TIME_UNIT_TO_FHIR[timeUnit];
  return {
    value: trigger.daysAfter,
    unit: fhirUnit.unit,
    system: 'http://unitsofmeasure.org',
    code: fhirUnit.code,
  };
}

function buildRelatedAction(trigger: OutreachAction['trigger']): any[] | undefined {
  if (trigger.daysAfter <= 0 && (!trigger.direction || trigger.direction === 'after')) return undefined;
  return [
    {
      actionId: 'start',
      relationship: trigger.direction === 'before' ? 'before' : 'after',
      offsetDuration: buildOffsetDuration(trigger),
    },
  ];
}

function encodeTemplate(template: string): string {
  return Buffer.from(template, 'utf-8').toString('base64');
}

function decodeTemplate(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function buildMediumSubAction(
  parentId: string,
  suffix: string,
  medium: NotificationMedium,
  template: string,
  label: string,
  statementType?: OutreachStatementType
): PlanDefinition['action'] extends (infer A)[] | undefined ? A : never {
  const action: any = {
    id: `${parentId}-${suffix}-${medium}`,
    title: `Send ${label} ${MEDIUM_DISPLAY[medium]}`,
    code: [
      {
        coding: [{ system: MEDIUM_SYSTEM, code: medium, display: MEDIUM_DISPLAY[medium] }],
      },
    ],
  };

  if (medium === 'paper-mail') {
    action.description = "Generate and mail a printed statement to the patient's address on file.";
    if (statementType) {
      action.documentation = [
        {
          type: 'documentation' as const,
          label: 'statement-type',
          document: {
            contentType: 'text/plain',
            data: encodeTemplate(statementType),
            title: 'Statement Type',
          },
        },
      ];
    }
  } else if (template) {
    action.documentation = [
      {
        type: 'documentation' as const,
        label: `${medium}-template`,
        document: {
          contentType: 'text/plain',
          data: encodeTemplate(template),
          title: `${label} ${MEDIUM_DISPLAY[medium]} Template`,
        },
      },
    ];
  }

  return action;
}

function buildNotificationSubActions(
  parentId: string,
  suffix: string,
  label: string,
  mediums: NotificationMedium[],
  smsTemplate: string,
  emailTemplate: string,
  statementType?: OutreachStatementType
): any[] {
  return mediums.map((medium) => {
    const template = medium === 'sms' ? smsTemplate : medium === 'email' ? emailTemplate : '';
    return buildMediumSubAction(parentId, suffix, medium, template, label, statementType);
  });
}

function buildChargeCardFhirAction(uiAction: OutreachAction): any {
  const cfg = uiAction.chargeCardConfig!;
  const subActions: any[] = [];

  if (cfg.onSuccess.enabled) {
    subActions.push({
      id: `${uiAction.id}-success`,
      title: 'Notify on Successful Charge',
      condition: [
        {
          kind: 'applicability',
          expression: {
            description: 'Charge was successful',
            language: 'text/fhirpath',
            expression: "%outcome = 'success'",
          },
        },
      ],
      code: [
        {
          coding: [{ system: ACTION_TYPE_SYSTEM, code: 'send-notification', display: 'Send Notification' }],
        },
      ],
      action: buildNotificationSubActions(
        uiAction.id,
        'success',
        'Success',
        cfg.onSuccess.mediums,
        cfg.onSuccess.smsTemplate,
        cfg.onSuccess.emailTemplate,
        cfg.onSuccess.statementType
      ),
    });
  }

  if (cfg.onFailure.enabled) {
    subActions.push({
      id: `${uiAction.id}-failure`,
      title: 'Notify on Failed Charge',
      condition: [
        {
          kind: 'applicability',
          expression: {
            description: 'Charge failed',
            language: 'text/fhirpath',
            expression: "%outcome = 'failure'",
          },
        },
      ],
      code: [
        {
          coding: [{ system: ACTION_TYPE_SYSTEM, code: 'send-notification', display: 'Send Notification' }],
        },
      ],
      action: buildNotificationSubActions(
        uiAction.id,
        'failure',
        'Failure',
        cfg.onFailure.mediums,
        cfg.onFailure.smsTemplate,
        cfg.onFailure.emailTemplate,
        cfg.onFailure.statementType
      ),
    });
  }

  return {
    id: uiAction.id,
    title: ACTION_TYPE_DISPLAY['charge-card'],
    priority: 'routine',
    code: [
      {
        coding: [{ system: ACTION_TYPE_SYSTEM, code: 'charge-card', display: ACTION_TYPE_DISPLAY['charge-card'] }],
      },
    ],
    trigger: [{ type: 'named-event', name: uiAction.trigger.event }],
    ...(cfg.retryAttempts > 0
      ? {
          timingTiming: {
            repeat: {
              count: cfg.retryAttempts,
              frequency: 1,
              period: cfg.retryIntervalDays,
              periodUnit: 'd',
            },
          },
        }
      : {}),
    ...(buildRelatedAction(uiAction.trigger) ? { relatedAction: buildRelatedAction(uiAction.trigger) } : {}),
    action: subActions,
  };
}

function buildSendNotificationFhirAction(uiAction: OutreachAction): any {
  const cfg = uiAction.sendNotificationConfig!;
  return {
    id: uiAction.id,
    title: ACTION_TYPE_DISPLAY['send-notification'],
    priority: 'routine',
    code: [
      {
        coding: [
          { system: ACTION_TYPE_SYSTEM, code: 'send-notification', display: ACTION_TYPE_DISPLAY['send-notification'] },
        ],
      },
    ],
    trigger: [{ type: 'named-event', name: uiAction.trigger.event }],
    ...(buildRelatedAction(uiAction.trigger) ? { relatedAction: buildRelatedAction(uiAction.trigger) } : {}),
    ...(uiAction.birthdayConfig ? { extension: [buildBirthdayConfigExtension(uiAction.birthdayConfig)] } : {}),
    action: buildNotificationSubActions(
      uiAction.id,
      'notify',
      'Notification',
      cfg.mediums,
      cfg.smsTemplate,
      cfg.emailTemplate,
      cfg.statementType
    ),
  };
}

function buildReferToCollectionsFhirAction(uiAction: OutreachAction): any {
  const cfg = uiAction.referToCollectionsConfig!;
  return {
    id: uiAction.id,
    title: ACTION_TYPE_DISPLAY['refer-to-collections'],
    priority: 'urgent',
    code: [
      {
        coding: [
          {
            system: ACTION_TYPE_SYSTEM,
            code: 'refer-to-collections',
            display: ACTION_TYPE_DISPLAY['refer-to-collections'],
          },
        ],
      },
    ],
    trigger: [{ type: 'named-event', name: uiAction.trigger.event }],
    ...(buildRelatedAction(uiAction.trigger) ? { relatedAction: buildRelatedAction(uiAction.trigger) } : {}),
    ...(cfg.minimumBalance > 0
      ? {
          condition: [
            {
              kind: 'applicability',
              expression: {
                description: `Only refer balances of $${cfg.minimumBalance} or more`,
                language: 'text/fhirpath',
                expression: `%balance >= ${cfg.minimumBalance}`,
              },
            },
          ],
        }
      : {}),
    ...(cfg.agency
      ? {
          participant: [
            {
              type: 'practitioner',
              role: {
                coding: [
                  {
                    system: COLLECTIONS_AGENCY_SYSTEM,
                    code: cfg.agency.toLowerCase().replace(/\s+/g, '-'),
                    display: cfg.agency,
                  },
                ],
              },
            },
          ],
        }
      : {}),
    ...(cfg.includePaymentHistory
      ? {
          input: [
            { type: 'Invoice', profile: ['http://hl7.org/fhir/StructureDefinition/Invoice'] },
            {
              type: 'PaymentReconciliation',
              profile: ['http://hl7.org/fhir/StructureDefinition/PaymentReconciliation'],
            },
          ],
        }
      : {}),
  };
}

function buildLogFhirAction(uiAction: OutreachAction): any {
  return {
    id: uiAction.id,
    title: ACTION_TYPE_DISPLAY['log'],
    code: [
      {
        coding: [
          {
            system: ACTION_TYPE_SYSTEM,
            code: 'log',
            display: ACTION_TYPE_DISPLAY['log'],
          },
        ],
      },
    ],
    trigger: [{ type: 'named-event', name: uiAction.trigger.event }],
    ...(buildRelatedAction(uiAction.trigger) ? { relatedAction: buildRelatedAction(uiAction.trigger) } : {}),
    ...(uiAction.birthdayConfig ? { extension: [buildBirthdayConfigExtension(uiAction.birthdayConfig)] } : {}),
  };
}

function uiActionToFhirAction(uiAction: OutreachAction): any {
  let fhirAction: any;
  switch (uiAction.actionType) {
    case 'charge-card':
      fhirAction = buildChargeCardFhirAction(uiAction);
      break;
    case 'send-notification':
      fhirAction = buildSendNotificationFhirAction(uiAction);
      break;
    case 'refer-to-collections':
      fhirAction = buildReferToCollectionsFhirAction(uiAction);
      break;
    case 'log':
      fhirAction = buildLogFhirAction(uiAction);
      break;
  }
  // Persist enabled state as an extension (only when explicitly disabled)
  if (uiAction.enabled === false) {
    fhirAction.extension = [...(fhirAction.extension || []), buildActionEnabledExtension(false)];
  }
  return fhirAction;
}

export function buildPlanDefinitionFromActions(
  actions: OutreachAction[],
  notificationsTimeRestriction?: NotificationsTimeRestriction
): Omit<PlanDefinition, 'id'> {
  return {
    resourceType: 'PlanDefinition',
    url: OUTREACH_PLAN_DEFINITION_URL,
    version: '1.0.0',
    name: 'ScheduledPatientOutreachWorkflow',
    title: 'Scheduled Patient Outreach Workflow',
    status: 'active',
    meta: rcmMeta('scheduled-outreach-config'),
    ...(notificationsTimeRestriction
      ? { extension: buildNotificationsTimeRestrictionExtension(notificationsTimeRestriction) }
      : {}),
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/plan-definition-type',
          code: 'workflow-definition',
          display: 'Workflow Definition',
        },
      ],
    },
    description:
      'Automated patient outreach workflow. Actions are triggered relative to billing events and executed in sequence by offset days.',
    purpose:
      'To automate patient balance collection through a series of escalating actions including card charges, notifications, and collections referral.',
    useContext: [
      {
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'workflow',
          display: 'Workflow Setting',
        },
        valueCodeableConcept: {
          coding: [
            {
              system: 'https://ottehr.com/CodeSystem/workflow-context',
              code: 'patient-ar',
              display: 'Patient Accounts Receivable',
            },
          ],
        },
      },
    ],
    topic: [
      {
        coding: [
          {
            system: 'https://ottehr.com/CodeSystem/outreach-topic',
            code: 'patient-collections',
            display: 'Patient Collections',
          },
        ],
      },
    ],
    action: actions.map(uiActionToFhirAction),
  };
}

// ── Conversion: FHIR → UI ─────────────────────────────────────────────────

function extractActionType(fhirAction: any): ActionType {
  const coding = fhirAction.code?.[0]?.coding?.[0];
  return (coding?.code as ActionType) || 'send-notification';
}

function extractTriggerEvent(fhirAction: any): TriggerEvent {
  return (fhirAction.trigger?.[0]?.name as TriggerEvent) || 'invoice-due';
}

function extractDaysAfter(fhirAction: any): number {
  return fhirAction.relatedAction?.[0]?.offsetDuration?.value ?? 0;
}

const FHIR_CODE_TO_TIME_UNIT: Record<string, TimeUnit> = {
  d: 'days',
  h: 'hours',
  min: 'minutes',
};

function extractTimeUnit(fhirAction: any): TimeUnit | undefined {
  const code = fhirAction.relatedAction?.[0]?.offsetDuration?.code;
  if (!code) return undefined;
  return FHIR_CODE_TO_TIME_UNIT[code] || undefined;
}

function extractDirection(fhirAction: any): TriggerDirection | undefined {
  const relationship = fhirAction.relatedAction?.[0]?.relationship;
  if (relationship === 'before') return 'before';
  if (relationship === 'after') return 'after';
  return undefined;
}

function extractTrigger(fhirAction: any): OutreachAction['trigger'] {
  const event = extractTriggerEvent(fhirAction);
  const daysAfter = extractDaysAfter(fhirAction);
  const timeUnit = extractTimeUnit(fhirAction);
  const direction = extractDirection(fhirAction);
  return {
    event,
    daysAfter,
    ...(timeUnit ? { timeUnit } : {}),
    ...(direction ? { direction } : {}),
  };
}

function extractMediumsAndTemplates(subActions: any[]): {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
} {
  const mediums: NotificationMedium[] = [];
  let smsTemplate = '';
  let emailTemplate = '';
  let statementType: OutreachStatementType | undefined;

  for (const sa of subActions || []) {
    const medium = sa.code?.[0]?.coding?.[0]?.code as NotificationMedium | undefined;
    if (!medium) continue;
    mediums.push(medium);
    if (medium === 'paper-mail') {
      const stDoc = sa.documentation?.find((d: any) => d.label === 'statement-type');
      if (stDoc?.document?.data) {
        statementType = decodeTemplate(stDoc.document.data) as OutreachStatementType;
      }
    } else {
      const docData = sa.documentation?.[0]?.document?.data;
      if (docData) {
        const decoded = decodeTemplate(docData);
        if (medium === 'sms') smsTemplate = decoded;
        if (medium === 'email') emailTemplate = decoded;
      }
    }
  }

  return { mediums, smsTemplate, emailTemplate, ...(statementType ? { statementType } : {}) };
}

function parseNotificationConfig(outcomeAction: any): NotificationConfig {
  if (!outcomeAction) return { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' };
  const { mediums, smsTemplate, emailTemplate, statementType } = extractMediumsAndTemplates(outcomeAction.action);
  return { enabled: true, mediums, smsTemplate, emailTemplate, ...(statementType ? { statementType } : {}) };
}

function parseChargeCardAction(fhirAction: any): OutreachAction {
  const successAction = fhirAction.action?.find((a: any) =>
    a.condition?.some((c: any) => c.expression?.expression?.includes("'success'"))
  );
  const failureAction = fhirAction.action?.find((a: any) =>
    a.condition?.some((c: any) => c.expression?.expression?.includes("'failure'"))
  );

  return {
    id: fhirAction.id || String(Date.now()),
    trigger: extractTrigger(fhirAction),
    actionType: 'charge-card',
    chargeCardConfig: {
      onSuccess: parseNotificationConfig(successAction),
      onFailure: parseNotificationConfig(failureAction),
      retryAttempts: fhirAction.timingTiming?.repeat?.count ?? 0,
      retryIntervalDays: fhirAction.timingTiming?.repeat?.period ?? 0,
    },
  };
}

function parseSendNotificationAction(fhirAction: any): OutreachAction {
  const { mediums, smsTemplate, emailTemplate, statementType } = extractMediumsAndTemplates(fhirAction.action);
  const bConfig = parseBirthdayConfig(fhirAction);
  return {
    id: fhirAction.id || String(Date.now()),
    trigger: extractTrigger(fhirAction),
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums,
      smsTemplate,
      emailTemplate,
      ...(statementType ? { statementType } : {}),
    },
    ...(bConfig ? { birthdayConfig: bConfig } : {}),
  };
}

function parseReferToCollectionsAction(fhirAction: any): OutreachAction {
  const agency = fhirAction.participant?.[0]?.role?.coding?.[0]?.display ?? '';
  const balanceExpr = fhirAction.condition?.find((c: any) => c.kind === 'applicability')?.expression?.expression ?? '';
  const balanceMatch = balanceExpr.match(/%balance\s*>=\s*(\d+)/);
  const minimumBalance = balanceMatch ? parseInt(balanceMatch[1], 10) : 0;
  const includePaymentHistory = (fhirAction.input?.length ?? 0) > 0;

  return {
    id: fhirAction.id || String(Date.now()),
    trigger: extractTrigger(fhirAction),
    actionType: 'refer-to-collections',
    referToCollectionsConfig: { agency, minimumBalance, includePaymentHistory },
  };
}

function parseLogAction(fhirAction: any): OutreachAction {
  const bConfig = parseBirthdayConfig(fhirAction);
  return {
    id: fhirAction.id || String(Date.now()),
    trigger: extractTrigger(fhirAction),
    actionType: 'log',
    ...(bConfig ? { birthdayConfig: bConfig } : {}),
  };
}

export function parsePlanDefinitionToActions(planDef: PlanDefinition): OutreachAction[] {
  if (!planDef.action) return [];
  return planDef.action.map((fhirAction: any) => {
    const actionType = extractActionType(fhirAction);
    let parsed: OutreachAction;
    switch (actionType) {
      case 'charge-card':
        parsed = parseChargeCardAction(fhirAction);
        break;
      case 'send-notification':
        parsed = parseSendNotificationAction(fhirAction);
        break;
      case 'refer-to-collections':
        parsed = parseReferToCollectionsAction(fhirAction);
        break;
      case 'log':
        parsed = parseLogAction(fhirAction);
        break;
      default:
        parsed = parseSendNotificationAction(fhirAction);
    }
    // Parse enabled state from extension
    const enabled = parseActionEnabled(fhirAction);
    if (!enabled) {
      parsed.enabled = false;
    }
    return parsed;
  });
}

// ── Get-or-create singleton ────────────────────────────────────────────────

function buildDefaultPlanDefinition(): Omit<PlanDefinition, 'id'> {
  return buildPlanDefinitionFromActions([]);
}

/**
 * Finds the existing outreach config PlanDefinition.
 * If it doesn't exist, creates one with defaults.
 * Guarantees at most one PlanDefinition exists; logs a warning if duplicates are detected.
 */
export async function getOrCreateOutreachConfig(oystehr: Oystehr): Promise<PlanDefinition> {
  const bundle = await oystehr.fhir.search<PlanDefinition>({
    resourceType: 'PlanDefinition',
    params: [
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|scheduled-outreach-config` },
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|rcm` },
    ],
  });
  const results = bundle.unbundle();

  if (results.length > 1) {
    const ids = results.map((r) => r.id).join(', ');
    console.warn(`Found ${results.length} outreach config PlanDefinitions (expected 1). Using the first. IDs: ${ids}`);
  }

  if (results.length > 0) {
    return results[0];
  }

  console.log('No outreach config PlanDefinition found, creating one with defaults');
  const defaultPlanDef = buildDefaultPlanDefinition();
  // Stamp an immutable activation timestamp at creation. This is used as a stable cutoff for
  // retroactive-send guards and must never change on subsequent config edits (unlike meta.lastUpdated).
  const withConfiguredAt: Omit<PlanDefinition, 'id'> = {
    ...defaultPlanDef,
    extension: [...(defaultPlanDef.extension ?? []), buildConfiguredAtExtension(new Date().toISOString())],
  };
  return await oystehr.fhir.create<PlanDefinition>(withConfiguredAt);
}

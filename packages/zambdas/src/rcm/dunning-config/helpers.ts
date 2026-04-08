import Oystehr from '@oystehr/sdk';
import { PlanDefinition } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { rcmMeta } from '../../shared';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;

export const DUNNING_PLAN_DEFINITION_URL = 'https://ottehr.com/r4/PlanDefinition/patient-dunning-workflow';

// ── UI types (mirrored from PatientDunning.tsx) ────────────────────────────

export type TriggerEvent = 'date-of-visit' | 'invoice-issued' | 'invoice-due';
export type NotificationMedium = 'sms' | 'email' | 'paper-mail';
export type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections';

export interface NotificationConfig {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
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
}

export interface ReferToCollectionsConfig {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

export interface DunningAction {
  id: string;
  trigger: {
    event: TriggerEvent;
    daysAfter: number;
  };
  actionType: ActionType;
  chargeCardConfig?: ChargeCardConfig;
  sendNotificationConfig?: SendNotificationConfig;
  referToCollectionsConfig?: ReferToCollectionsConfig;
}

// ── FHIR code systems ──────────────────────────────────────────────────────

const ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/dunning-action-type';
const MEDIUM_SYSTEM = 'https://ottehr.com/CodeSystem/notification-medium';
const COLLECTIONS_AGENCY_SYSTEM = 'https://ottehr.com/CodeSystem/collections-agency';

const ACTION_TYPE_DISPLAY: Record<ActionType, string> = {
  'charge-card': 'Charge Credit Card on File',
  'send-notification': 'Send Notification',
  'refer-to-collections': 'Refer to Collections',
};

const MEDIUM_DISPLAY: Record<NotificationMedium, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail Statement',
};

// ── Conversion: UI → FHIR ─────────────────────────────────────────────────

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
  label: string
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
  emailTemplate: string
): any[] {
  return mediums.map((medium) => {
    const template = medium === 'sms' ? smsTemplate : medium === 'email' ? emailTemplate : '';
    return buildMediumSubAction(parentId, suffix, medium, template, label);
  });
}

function buildChargeCardFhirAction(uiAction: DunningAction): any {
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
        cfg.onSuccess.emailTemplate
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
        cfg.onFailure.emailTemplate
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
    timingTiming: {
      repeat: {
        count: cfg.retryAttempts,
        frequency: 1,
        period: cfg.retryIntervalDays,
        periodUnit: 'd',
      },
    },
    ...(uiAction.trigger.daysAfter > 0
      ? {
          relatedAction: [
            {
              actionId: 'start',
              relationship: 'after',
              offsetDuration: {
                value: uiAction.trigger.daysAfter,
                unit: 'days',
                system: 'http://unitsofmeasure.org',
                code: 'd',
              },
            },
          ],
        }
      : {}),
    action: subActions,
  };
}

function buildSendNotificationFhirAction(uiAction: DunningAction): any {
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
    ...(uiAction.trigger.daysAfter > 0
      ? {
          relatedAction: [
            {
              actionId: 'start',
              relationship: 'after',
              offsetDuration: {
                value: uiAction.trigger.daysAfter,
                unit: 'days',
                system: 'http://unitsofmeasure.org',
                code: 'd',
              },
            },
          ],
        }
      : {}),
    action: buildNotificationSubActions(
      uiAction.id,
      'notify',
      'Notification',
      cfg.mediums,
      cfg.smsTemplate,
      cfg.emailTemplate
    ),
  };
}

function buildReferToCollectionsFhirAction(uiAction: DunningAction): any {
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
    ...(uiAction.trigger.daysAfter > 0
      ? {
          relatedAction: [
            {
              actionId: 'start',
              relationship: 'after',
              offsetDuration: {
                value: uiAction.trigger.daysAfter,
                unit: 'days',
                system: 'http://unitsofmeasure.org',
                code: 'd',
              },
            },
          ],
        }
      : {}),
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

function uiActionToFhirAction(uiAction: DunningAction): any {
  switch (uiAction.actionType) {
    case 'charge-card':
      return buildChargeCardFhirAction(uiAction);
    case 'send-notification':
      return buildSendNotificationFhirAction(uiAction);
    case 'refer-to-collections':
      return buildReferToCollectionsFhirAction(uiAction);
  }
}

export function buildPlanDefinitionFromActions(actions: DunningAction[]): Omit<PlanDefinition, 'id'> {
  return {
    resourceType: 'PlanDefinition',
    url: DUNNING_PLAN_DEFINITION_URL,
    version: '1.0.0',
    name: 'PatientDunningWorkflow',
    title: 'Patient AR Dunning Workflow',
    status: 'active',
    meta: rcmMeta('dunning-config'),
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
      'Automated patient accounts receivable dunning workflow. Actions are triggered relative to billing events and executed in sequence by offset days.',
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
            system: 'https://ottehr.com/CodeSystem/dunning-topic',
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

function extractMediumsAndTemplates(subActions: any[]): {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
} {
  const mediums: NotificationMedium[] = [];
  let smsTemplate = '';
  let emailTemplate = '';

  for (const sa of subActions || []) {
    const medium = sa.code?.[0]?.coding?.[0]?.code as NotificationMedium | undefined;
    if (!medium) continue;
    mediums.push(medium);
    const docData = sa.documentation?.[0]?.document?.data;
    if (docData) {
      const decoded = decodeTemplate(docData);
      if (medium === 'sms') smsTemplate = decoded;
      if (medium === 'email') emailTemplate = decoded;
    }
  }

  return { mediums, smsTemplate, emailTemplate };
}

function parseNotificationConfig(outcomeAction: any): NotificationConfig {
  if (!outcomeAction) return { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' };
  const { mediums, smsTemplate, emailTemplate } = extractMediumsAndTemplates(outcomeAction.action);
  return { enabled: true, mediums, smsTemplate, emailTemplate };
}

function parseChargeCardAction(fhirAction: any): DunningAction {
  const successAction = fhirAction.action?.find(
    (a: any) => a.condition?.some((c: any) => c.expression?.expression?.includes("'success'"))
  );
  const failureAction = fhirAction.action?.find(
    (a: any) => a.condition?.some((c: any) => c.expression?.expression?.includes("'failure'"))
  );

  return {
    id: fhirAction.id || String(Date.now()),
    trigger: { event: extractTriggerEvent(fhirAction), daysAfter: extractDaysAfter(fhirAction) },
    actionType: 'charge-card',
    chargeCardConfig: {
      onSuccess: parseNotificationConfig(successAction),
      onFailure: parseNotificationConfig(failureAction),
      retryAttempts: fhirAction.timingTiming?.repeat?.count ?? 1,
      retryIntervalDays: fhirAction.timingTiming?.repeat?.period ?? 3,
    },
  };
}

function parseSendNotificationAction(fhirAction: any): DunningAction {
  const { mediums, smsTemplate, emailTemplate } = extractMediumsAndTemplates(fhirAction.action);
  return {
    id: fhirAction.id || String(Date.now()),
    trigger: { event: extractTriggerEvent(fhirAction), daysAfter: extractDaysAfter(fhirAction) },
    actionType: 'send-notification',
    sendNotificationConfig: { mediums, smsTemplate, emailTemplate },
  };
}

function parseReferToCollectionsAction(fhirAction: any): DunningAction {
  const agency = fhirAction.participant?.[0]?.role?.coding?.[0]?.display ?? '';
  const balanceExpr = fhirAction.condition?.find((c: any) => c.kind === 'applicability')?.expression?.expression ?? '';
  const balanceMatch = balanceExpr.match(/%balance\s*>=\s*(\d+)/);
  const minimumBalance = balanceMatch ? parseInt(balanceMatch[1], 10) : 0;
  const includePaymentHistory = (fhirAction.input?.length ?? 0) > 0;

  return {
    id: fhirAction.id || String(Date.now()),
    trigger: { event: extractTriggerEvent(fhirAction), daysAfter: extractDaysAfter(fhirAction) },
    actionType: 'refer-to-collections',
    referToCollectionsConfig: { agency, minimumBalance, includePaymentHistory },
  };
}

export function parsePlanDefinitionToActions(planDef: PlanDefinition): DunningAction[] {
  if (!planDef.action) return [];
  return planDef.action.map((fhirAction: any) => {
    const actionType = extractActionType(fhirAction);
    switch (actionType) {
      case 'charge-card':
        return parseChargeCardAction(fhirAction);
      case 'send-notification':
        return parseSendNotificationAction(fhirAction);
      case 'refer-to-collections':
        return parseReferToCollectionsAction(fhirAction);
      default:
        return parseSendNotificationAction(fhirAction);
    }
  });
}

// ── Get-or-create singleton ────────────────────────────────────────────────

function buildDefaultPlanDefinition(): Omit<PlanDefinition, 'id'> {
  return buildPlanDefinitionFromActions([]);
}

/**
 * Finds the existing dunning config PlanDefinition.
 * If it doesn't exist, creates one with defaults.
 * Guarantees at most one PlanDefinition exists; logs a warning if duplicates are detected.
 */
export async function getOrCreateDunningConfig(oystehr: Oystehr): Promise<PlanDefinition> {
  const bundle = await oystehr.fhir.search<PlanDefinition>({
    resourceType: 'PlanDefinition',
    params: [
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|dunning-config` },
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|rcm` },
    ],
  });
  const results = bundle.unbundle();

  if (results.length > 1) {
    const ids = results.map((r) => r.id).join(', ');
    console.warn(`Found ${results.length} dunning config PlanDefinitions (expected 1). Using the first. IDs: ${ids}`);
  }

  if (results.length > 0) {
    return results[0];
  }

  console.log('No dunning config PlanDefinition found, creating one with defaults');
  return await oystehr.fhir.create<PlanDefinition>(buildDefaultPlanDefinition());
}

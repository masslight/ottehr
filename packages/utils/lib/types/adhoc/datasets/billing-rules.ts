import { z } from 'zod';
import { RULES_ENGINE_TYPES } from '../../data/billing/rules-engine.constants';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const BILLING_RULES_DATASET_ID = 'billing-rules';

// Rule condition fields whose value comes from the claim's service lines (rules-engine field catalog).
export const SERVICE_LINE_CONDITION_FIELDS = [
  'cptCodes',
  'duplicateCptCodes',
  'placeOfServiceCodes',
  'serviceLineCount',
] as const;

export const BillingRulesBaseRowSchema = z.object({
  ruleId: z.string().describe('Rule id (internal).'),
  engine: z
    .enum(RULES_ENGINE_TYPES)
    .describe(
      'Rules engine the rule belongs to: "claim-submission" (runs before a claim is submitted to the payer), ' +
        '"non-insurance-payer-pre-invoice", "patient-ar-pre-invoice" (run before invoicing).'
    ),
  position: z.number().describe('Order of the rule within its engine, 1 = runs first.'),
  name: z.string().describe('Rule name.'),
  description: z.string().describe('Rule description. "" when none.'),
  enabled: z.boolean().describe('True when the rule is active.'),
  conditionFields: z
    .array(z.string())
    .describe('Claim fields the rule tests in its conditions (e.g. "payerId", "cptCodes", "patient.state").'),
  serviceLineConditionFields: z
    .array(z.string())
    .describe(`Condition fields that read the claim's service lines (${SERVICE_LINE_CONDITION_FIELDS.join(', ')}).`),
  serviceLineMatchProperties: z
    .array(z.string())
    .describe('Service line properties the rule\'s actions select lines by (e.g. "cptCode", "modifiers", "units").'),
  hasServiceLineConditions: z
    .boolean()
    .describe(
      'True when the rule has a condition on service lines: a service-line condition field, or an action that ' +
        'selects service lines by a property.'
    ),
  actionTypes: z
    .array(z.string())
    .describe(
      'What the rule does: setField, applyTag, addServiceLine, updateServiceLines, removeServiceLines, ' +
        'applyChargeMasterPrices.'
    ),
});

export const BILLING_RULES_INTERNAL_FIELDS: readonly (keyof AdHocBillingRulesRow)[] = ['ruleId'];

export const BILLING_RULES_DOMAIN_FIELDS: readonly (keyof AdHocBillingRulesRow)[] = [
  'conditionFields',
  'serviceLineConditionFields',
  'serviceLineMatchProperties',
  'actionTypes',
];

export const BILLING_RULES_LAYERS = {} as const satisfies AdHocLayerMap;

export type AdHocBillingRulesRow = z.infer<typeof BillingRulesBaseRowSchema> &
  LayerRowFields<typeof BILLING_RULES_LAYERS>;

export const AdHocBillingRulesRowSchema = datasetRowSchema(BillingRulesBaseRowSchema, BILLING_RULES_LAYERS).describe(
  'One row per billing rule.'
) as unknown as z.ZodType<AdHocBillingRulesRow>;

export const AdHocBillingRulesInputSchema = datasetInputSchema(BILLING_RULES_LAYERS);
export type AdHocBillingRulesInput = DatasetInput<typeof BILLING_RULES_LAYERS>;

export const AdHocBillingRulesOutputSchema = z.object({
  rows: z.array(AdHocBillingRulesRowSchema),
});

export type AdHocBillingRulesOutput = { rows: AdHocBillingRulesRow[] };

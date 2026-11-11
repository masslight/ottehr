// What each ad-hoc dataset is keyed by and which layers it offers — its own and the foreign ones. The front
// end, infer and the workers read this; it has no fetch code.
import { z } from 'zod';
import { BILLING_ALL_LAYERS, BillingBaseRowSchema } from './billing';
import { BILLING_CLAIMS_DATASET_ID, BILLING_CLAIMS_LAYERS, BillingClaimsBaseRowSchema } from './billing-claims';
import { BILLING_RULES_DATASET_ID, BILLING_RULES_LAYERS, BillingRulesBaseRowSchema } from './billing-rules';
import { AdHocLayerMap } from './dataset';
import { ENCOUNTER_ALL_LAYERS, EncounterBaseRowSchema } from './encounters';
import { PATIENT_LAYERS, PatientBaseRowSchema } from './patients';

export interface AdHocDatasetMeta {
  /** The base field that identifies a row; a dataset's own layers are keyed by it. */
  rowKey: string;
  baseSchema: z.ZodObject<z.ZodRawShape>;
  /** Own layers, then foreign layers (`<dataset>.<layer>`), each with its key field in the base. */
  layers: AdHocLayerMap;
}

export const DATASET_META: Record<string, AdHocDatasetMeta> = {
  'encounters-comprehensive': {
    rowKey: 'encounterId',
    baseSchema: EncounterBaseRowSchema,
    layers: ENCOUNTER_ALL_LAYERS,
  },
  patients: { rowKey: 'patientId', baseSchema: PatientBaseRowSchema, layers: PATIENT_LAYERS },
  billing: { rowKey: 'encounterId', baseSchema: BillingBaseRowSchema, layers: BILLING_ALL_LAYERS },
  [BILLING_CLAIMS_DATASET_ID]: {
    rowKey: 'claimId',
    baseSchema: BillingClaimsBaseRowSchema,
    layers: BILLING_CLAIMS_LAYERS,
  },
  [BILLING_RULES_DATASET_ID]: { rowKey: 'ruleId', baseSchema: BillingRulesBaseRowSchema, layers: BILLING_RULES_LAYERS },
};

/** Every layer a dataset offers (own + foreign). Empty for an unknown dataset. */
export function layersForDataset(datasetId: string): AdHocLayerMap {
  return DATASET_META[datasetId]?.layers ?? {};
}

import { z } from 'zod';
import { BILLING_ALL_LAYERS, BillingBaseRowSchema } from './billing';
import { BILLING_CLAIMS_DATASET_ID, BILLING_CLAIMS_LAYERS, BillingClaimsBaseRowSchema } from './billing-claims';
import { BILLING_RULES_DATASET_ID, BILLING_RULES_LAYERS, BillingRulesBaseRowSchema } from './billing-rules';
import { AdHocLayerMap } from './dataset';
import { ENCOUNTER_ALL_LAYERS, EncounterBaseRowSchema } from './encounters';
import {
  MEDICATION_INVENTORY_DATASET_ID,
  MEDICATION_INVENTORY_LAYERS,
  MedicationInventoryBaseRowSchema,
} from './medication-inventory';
import { PATIENT_LAYERS, PatientBaseRowSchema } from './patients';

export interface AdHocDatasetMeta {
  rowKey: string;
  baseSchema: z.ZodObject<z.ZodRawShape>;
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
  [MEDICATION_INVENTORY_DATASET_ID]: {
    rowKey: 'entryId',
    baseSchema: MedicationInventoryBaseRowSchema,
    layers: MEDICATION_INVENTORY_LAYERS,
  },
  [BILLING_RULES_DATASET_ID]: { rowKey: 'ruleId', baseSchema: BillingRulesBaseRowSchema, layers: BILLING_RULES_LAYERS },
};

export function layersForDataset(datasetId: string): AdHocLayerMap {
  return DATASET_META[datasetId]?.layers ?? {};
}

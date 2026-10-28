import type { RadiologyDiagnosis } from 'src/features/radiology/components/RadiologyDiagnosisField';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DmeDurationUnit, DmeLaterality, DmeModifier, DmeThirdParty } from 'utils/lib/types/api/dme.types';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';

export interface DmeOrderFormValues {
  itemName: string;
  diagnoses: RadiologyDiagnosis[];
  quantity: string;
  laterality: DmeLaterality | null;
  modifier: DmeModifier | null;
  durationValue: string;
  durationUnit: DmeDurationUnit | null;
  orderedBy: { id: string; name?: string } | null;
  instructions: string;
  billingCodes: CPTCodeDTO[];
  external: boolean;
  thirdParty: { name: string; address: string; phone: string; fax: string };
}

// diagnoses are per patient (and get added to the chart on submit), so like procedures a pick never carries them
export type DmeQuickPickPatch = Partial<Omit<DmeOrderFormValues, 'orderedBy' | 'diagnoses'>>;

interface CodeDisplay {
  code: string;
  display: string;
}

export const toCodeDisplay = ({ code, display }: CodeDisplay): CodeDisplay => ({ code, display });

export function applyDmeQuickPick(quickPick: DmeQuickPickData): DmeQuickPickPatch {
  // the pick's codes replace the form's, so codes left over from another item do not carry over
  const patch: DmeQuickPickPatch = { billingCodes: (quickPick.billingCodes ?? []).map(toCodeDisplay) };
  const itemName = quickPick.itemName?.trim();
  if (itemName) patch.itemName = itemName;

  if (quickPick.quantity !== undefined) patch.quantity = String(quickPick.quantity);
  if (quickPick.laterality) patch.laterality = quickPick.laterality;
  if (quickPick.modifier) patch.modifier = quickPick.modifier;
  if (quickPick.duration) {
    patch.durationValue = String(quickPick.duration.value);
    patch.durationUnit = quickPick.duration.unit;
  }
  if (quickPick.instructions !== undefined) patch.instructions = quickPick.instructions;
  if (quickPick.external !== undefined) patch.external = quickPick.external;
  // always replaced, so a previous pick's supplier and fax never carry over
  const thirdParty = quickPick.external === false ? undefined : quickPick.thirdParty;
  patch.thirdParty = {
    name: thirdParty?.name ?? '',
    address: thirdParty?.address ?? '',
    phone: thirdParty?.phone ?? '',
    fax: thirdParty?.fax ?? '',
  };

  return patch;
}

const THIRD_PARTY_KEYS = ['name', 'address', 'phone', 'fax'] as const;

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined;

export function buildDmeQuickPick(values: DmeOrderFormValues, name: string): Omit<DmeQuickPickData, 'id'> {
  const quickPick: Omit<DmeQuickPickData, 'id'> = {
    name: name.trim(),
    itemName: values.itemName.trim(),
    billingCodes: values.billingCodes.map(toCodeDisplay),
  };

  const quantity = values.quantity.trim();
  if (/^\d+$/.test(quantity) && Number(quantity) > 0) quickPick.quantity = Number(quantity);

  if (values.laterality) quickPick.laterality = values.laterality;
  if (values.modifier) quickPick.modifier = values.modifier;

  const durationValue = Number(values.durationValue);
  if (values.durationValue.trim() && durationValue > 0 && values.durationUnit) {
    quickPick.duration = { value: durationValue, unit: values.durationUnit };
  }

  const instructions = trimmed(values.instructions);
  if (instructions) quickPick.instructions = instructions;

  quickPick.external = values.external;
  if (values.external) {
    const thirdParty: DmeThirdParty = {};
    THIRD_PARTY_KEYS.forEach((key) => {
      const value = trimmed(values.thirdParty[key]);
      if (value) thirdParty[key] = value;
    });
    if (Object.keys(thirdParty).length) quickPick.thirdParty = thirdParty;
  }

  return quickPick;
}

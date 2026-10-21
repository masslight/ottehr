import type { RadiologyDiagnosis } from 'src/features/radiology/components/RadiologyDiagnosisField';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DmeDurationUnit, DmeLaterality, DmeMenuItem, DmeModifier, DmeThirdParty } from 'utils/lib/types/api/dme.types';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';

export const OTHER_ITEM_OPTION: DmeMenuItem = { id: 'other', name: 'Other', hcpcsCodes: [] };

export interface DmeOrderFormValues {
  item: DmeMenuItem | null;
  otherItemName: string;
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

export const isOtherItem = (item: DmeMenuItem | null): boolean => item?.id === OTHER_ITEM_OPTION.id;

interface CodeDisplay {
  code: string;
  display: string;
}

export const toCodeDisplay = ({ code, display }: CodeDisplay): CodeDisplay => ({ code, display });

const resolveItem = (
  quickPick: DmeQuickPickData,
  menuItems: readonly DmeMenuItem[]
): { item: DmeMenuItem; otherItemName?: string } | undefined => {
  const byId = quickPick.menuItemId ? menuItems.find((menuItem) => menuItem.id === quickPick.menuItemId) : undefined;
  if (byId) return { item: byId };
  const itemName = quickPick.itemName?.trim();
  if (!itemName) return undefined;
  const byName = menuItems.find((menuItem) => menuItem.name.trim().toLowerCase() === itemName.toLowerCase());
  return byName ? { item: byName } : { item: OTHER_ITEM_OPTION, otherItemName: itemName };
};

export function applyDmeQuickPick(
  current: DmeOrderFormValues,
  quickPick: DmeQuickPickData,
  menuItems: readonly DmeMenuItem[]
): DmeQuickPickPatch {
  const patch: DmeQuickPickPatch = {};
  const resolved = resolveItem(quickPick, menuItems);

  if (resolved) {
    patch.item = resolved.item;
    if (resolved.otherItemName !== undefined) patch.otherItemName = resolved.otherItemName;
  }

  const sameItem = !!resolved && resolved.item.id === current.item?.id;
  const billingCodes = quickPick.billingCodes ?? (resolved && !sameItem ? resolved.item.hcpcsCodes : undefined);
  if (billingCodes) patch.billingCodes = billingCodes.map(toCodeDisplay);

  if (quickPick.quantity !== undefined) patch.quantity = String(quickPick.quantity);
  if (quickPick.laterality) patch.laterality = quickPick.laterality;
  if (quickPick.modifier) patch.modifier = quickPick.modifier;
  if (quickPick.duration) {
    patch.durationValue = String(quickPick.duration.value);
    patch.durationUnit = quickPick.duration.unit;
  }
  if (quickPick.instructions !== undefined) patch.instructions = quickPick.instructions;
  if (quickPick.external !== undefined) patch.external = quickPick.external;
  if (quickPick.thirdParty && quickPick.external !== false) {
    patch.thirdParty = {
      name: quickPick.thirdParty.name ?? '',
      address: quickPick.thirdParty.address ?? '',
      phone: quickPick.thirdParty.phone ?? '',
      fax: quickPick.thirdParty.fax ?? '',
    };
  }

  return patch;
}

const THIRD_PARTY_KEYS = ['name', 'address', 'phone', 'fax'] as const;

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined;

export function buildDmeQuickPick(values: DmeOrderFormValues, name: string): Omit<DmeQuickPickData, 'id'> {
  const quickPick: Omit<DmeQuickPickData, 'id'> = { name: name.trim() };
  const other = isOtherItem(values.item);

  if (values.item && !other) quickPick.menuItemId = values.item.id;
  const itemName = trimmed(other ? values.otherItemName : values.item?.name);
  if (itemName) quickPick.itemName = itemName;

  const quantity = values.quantity.trim();
  if (/^\d+$/.test(quantity) && Number(quantity) > 0) quickPick.quantity = Number(quantity);

  // an empty list is kept for a selected item so applying the pick does not bring back the menu's default codes
  if (values.billingCodes.length || values.item) quickPick.billingCodes = values.billingCodes.map(toCodeDisplay);

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

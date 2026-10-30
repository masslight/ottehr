import { Extension, Medication } from 'fhir/r4b';
import { InHouseMedicationInventory, InHouseMedicationInventorySchema } from '../types/api/config/in-house-medications';
import { MEDICATION_ADMINISTRATION_UNITS_SYSTEM } from '../types/api/medication-administration.constants';
import { getExtension } from './helpers';
import { ottehrExtensionUrl } from './systemUrls';

/** On an in-house Medication: its inventory setup. Absent means the drug is not tracked. */
export const MEDICATION_INVENTORY_EXTENSION_URL = ottehrExtensionUrl('medication-inventory');

const COUNTED_AS = 'counted-as';
const EACH_CONTAINS = 'each-contains';
const EACH_CONTAINS_IN = 'each-contains-in';
const USE = 'use';
const REORDER_LEVEL = 'reorder-level';
const REORDER_LEVEL_CLINIC = 'clinic';
const REORDER_LEVEL_LEVEL = 'level';

const makeAmountExtension = (url: string, amount: { amount: number; unit: string }): Extension => ({
  url,
  valueQuantity: { value: amount.amount, unit: amount.unit, system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM },
});

const readAmount = (extension: Extension | undefined): { amount?: number; unit?: string } | undefined =>
  extension?.valueQuantity ? { amount: extension.valueQuantity.value, unit: extension.valueQuantity.unit } : undefined;

export const makeMedicationInventoryExtension = (inventory: InHouseMedicationInventory): Extension => ({
  url: MEDICATION_INVENTORY_EXTENSION_URL,
  extension: [
    { url: COUNTED_AS, valueCode: inventory.countedAs },
    makeAmountExtension(EACH_CONTAINS, inventory.eachContains),
    ...(inventory.eachContains.in ? [makeAmountExtension(EACH_CONTAINS_IN, inventory.eachContains.in)] : []),
    { url: USE, valueCode: inventory.use },
    ...[...inventory.reorderLevels]
      .sort((a, b) => a.locationId.localeCompare(b.locationId))
      .map(({ locationId, level }) => ({
        url: REORDER_LEVEL,
        extension: [
          { url: REORDER_LEVEL_CLINIC, valueReference: { reference: `Location/${locationId}` } },
          { url: REORDER_LEVEL_LEVEL, valueInteger: level },
        ],
      })),
  ],
});

/** The inventory setup on a Medication, or undefined when it has none (or an unreadable one). */
export const getMedicationInventoryConfig = (medication: Medication): InHouseMedicationInventory | undefined => {
  const root = getExtension(medication, MEDICATION_INVENTORY_EXTENSION_URL);
  if (!root) return undefined;
  const inAmount = readAmount(getExtension(root, EACH_CONTAINS_IN));
  const parsed = InHouseMedicationInventorySchema.safeParse({
    countedAs: getExtension(root, COUNTED_AS)?.valueCode,
    eachContains: { ...readAmount(getExtension(root, EACH_CONTAINS)), ...(inAmount ? { in: inAmount } : {}) },
    use: getExtension(root, USE)?.valueCode,
    reorderLevels: (root.extension ?? [])
      .filter((extension) => extension.url === REORDER_LEVEL)
      .map((extension) => ({
        locationId: getExtension(extension, REORDER_LEVEL_CLINIC)?.valueReference?.reference?.replace('Location/', ''),
        level: getExtension(extension, REORDER_LEVEL_LEVEL)?.valueInteger,
      })),
  });
  return parsed.success ? parsed.data : undefined;
};

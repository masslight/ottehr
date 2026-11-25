// Zod is the single source of truth for this dataset; field descriptions are written for the LLM.
import { z } from 'zod';
import {
  INVENTORY_ENTRY_REASON_LABELS,
  INVENTORY_ENTRY_REASONS,
  INVENTORY_ENTRY_TYPES,
} from '../../api/config/in-house-medications';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const MEDICATION_INVENTORY_DATASET_ID = 'medication-inventory';

const REASON_DESCRIPTION = INVENTORY_ENTRY_REASONS.map(
  (reason) => `${reason} = ${INVENTORY_ENTRY_REASON_LABELS[reason]}`
).join('; ');

export const MedicationInventoryBaseRowSchema = z.object({
  entryId: z.string().describe('Stock entry id (internal — dedupe).'),
  date: z.string().nullable().describe('Viewer-local day of the entry (yyyy-MM-dd); day-level companion of dateTime.'),
  dateTime: z
    .string()
    .describe(
      "Full ISO instant the entry was recorded. Format in the user's LOCAL timezone via new Date(dateTime).toLocaleTimeString(...); " +
        'do NOT slice the ISO string (shows UTC). A reversal is dated when the order was changed or deleted, which can be ' +
        'in a later period than the administration it reverses.'
    ),
  entryType: z
    .enum(INVENTORY_ENTRY_TYPES)
    .describe(
      'What the entry is: received = a shipment received; administered = a medication given at a visit; ' +
        'administration-reversed = an administration deleted or changed, putting its stock back; adjustment = a ' +
        'manual change with a reason; count = a shelf count (the difference, or 0 with reason no-difference).'
    ),
  reason: z
    .enum(INVENTORY_ENTRY_REASONS)
    .nullable()
    .describe(
      `Why stock changed, on adjustments, counts, and administrations and reversals with waste (${REASON_DESCRIPTION}). ` +
        'Waste by reason = adjustments plus partial-dose-waste. Null when the entry has no reason (received, and ' +
        'administrations and reversals without waste).'
    ),
  note: z.string().describe('Free text entered with reason "other". "" when none.'),
  quantity: z
    .number()
    .describe(
      'Signed change in stock, in unit: positive adds stock (received, administration reversed, count up), negative ' +
        'takes it off the shelf. Usage = minus the sum of quantity over administered AND administration-reversed rows ' +
        "(a reversal puts back what an earlier administration took, so it cancels that usage); the sum of a lot's " +
        'entries is its on hand.'
    ),
  unit: z.string().describe("Stock unit: the drug's counting unit (vial, tablet, tube …)."),
  wasteAmount: z
    .number()
    .nullable()
    .describe(
      'Dose wasted on an administration (the unused part of a single-use container), in wasteUnit; negative on a ' +
        'reversal, cancelling the waste it takes back, so total waste is the plain sum. Null when no waste.'
    ),
  wasteUnit: z.string().describe('Unit of wasteAmount (mg, ml …). "" when no waste.'),
  performer: z.string().describe('Staff member who made the entry (full name). "" when unknown.'),
  performerId: z.string().describe('Performer id (internal — joins).'),
  location: z.string().describe('Location name the lot is kept at.'),
  locationId: z.string().describe('Location id (internal — joins).'),
  medication: z.string().describe('Medication name as listed in the in-house medication catalog.'),
  medicationId: z.string().describe('Catalog medication id (internal — joins).'),
  lotId: z.string().describe('Lot id (internal — joins). A lot is one drug × location × lot number × expiration date.'),
  lotNumber: z.string().describe('Manufacturer lot number.'),
  expirationDate: z.string().describe('The lot\'s expiration date (yyyy-MM-dd). "" when unknown.'),
  ndc: z.string().describe('NDC from the box. "" when none.'),
  manufacturer: z.string().describe('Manufacturer. "" when none.'),
  vendor: z
    .string()
    .describe(
      'Vendor: on a received entry the vendor of that shipment, on every other entry the vendor the lot was last ' +
        'received from. "" when none.'
    ),
  lotOnHand: z
    .number()
    .nullable()
    .describe(
      "The lot's on hand NOW (after every entry to date, not as of this row), in unit; the same on every row of a " +
        'lot. For expiring stock take one row per lotId (a lot appears only when it had an entry in range), keep ' +
        'lotOnHand > 0 and filter by expirationDate. Null when the lot could not be read.'
    ),
  appointmentId: z
    .string()
    .nullable()
    .describe('Visit id when the entry came from a medication given at a visit. Null otherwise.'),
  patientId: z.string().nullable().describe('Patient id for a visit-linked entry. Null otherwise.'),
  patientName: z.string().describe('Patient full name for a visit-linked entry. "" otherwise.'),
});

export const MEDICATION_INVENTORY_INTERNAL_FIELDS: readonly (keyof AdHocMedicationInventoryRow)[] = [
  'entryId',
  'performerId',
  'locationId',
  'medicationId',
  'lotId',
];

export const MEDICATION_INVENTORY_DOMAIN_FIELDS: readonly (keyof AdHocMedicationInventoryRow)[] = [
  'location',
  'medication',
  'manufacturer',
  'vendor',
  'unit',
];

export const MEDICATION_INVENTORY_LAYERS = {} as const satisfies AdHocLayerMap;

export type AdHocMedicationInventoryRow = z.infer<typeof MedicationInventoryBaseRowSchema> &
  LayerRowFields<typeof MEDICATION_INVENTORY_LAYERS>;

export const AdHocMedicationInventoryRowSchema = datasetRowSchema(
  MedicationInventoryBaseRowSchema,
  MEDICATION_INVENTORY_LAYERS
).describe('One row per medication stock entry in range.') as unknown as z.ZodType<AdHocMedicationInventoryRow>;

export const AdHocMedicationInventoryInputSchema = datasetInputSchema(MEDICATION_INVENTORY_LAYERS);
export type AdHocMedicationInventoryInput = DatasetInput<typeof MEDICATION_INVENTORY_LAYERS>;

export const AdHocMedicationInventoryOutputSchema = z.object({
  rows: z.array(AdHocMedicationInventoryRowSchema),
});

export type AdHocMedicationInventoryOutput = { rows: AdHocMedicationInventoryRow[] };

import { otherColors } from '@ehrTheme/colors';
import { Chip } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import {
  INVENTORY_ENTRY_REASON_LABELS,
  INVENTORY_MARKER_LABELS,
  InventoryEntryType,
  InventoryHistoryEntry,
  InventoryLot,
  InventoryMarker,
  MEDICATION_COUNTED_AS_LABELS,
  MedicationCountedAs,
} from 'utils/lib/types/api/config/in-house-medications';
import { DISPLAY_DATE_FORMAT, formatDateForDisplay } from 'utils/lib/utils/dateUtils';

// Display helpers for the inventory screen and its dialogs. Quantities are shown in the lot's unit: counted-as
// items ("vial"/"vials"), or the unit as stored when it is not one (measured multi-use drugs).

const MINUS = '−';

export const inventoryButtonSx = { textTransform: 'none', borderRadius: 50, fontWeight: 'bold' };

// The location the Tracking Board's location picker last saved, when it is one of the in-person locations.
export function storedLocationId(locations: { id: string }[]): string | undefined {
  try {
    const stored = localStorage.getItem('selectedLocation');
    const id = stored ? (JSON.parse(stored) as { id?: string }).id : undefined;
    return locations.some((location) => location.id === id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export const unitLabel = (unit: string, count: number): string => {
  const labels = MEDICATION_COUNTED_AS_LABELS[unit as MedicationCountedAs];
  if (!labels) return unit;
  return Math.abs(count) === 1 ? labels.singular.toLowerCase() : labels.plural;
};

/** "22 vials", "−2 vials". */
export const formatOnHand = (count: number, unit: string): string =>
  `${count < 0 ? MINUS : ''}${Math.abs(count)} ${unitLabel(unit, count)}`;

/** "+25 vials", "−1 vial", "0 vials". */
export const formatChange = (quantity: number, unit: string): string =>
  `${quantity > 0 ? '+' : quantity < 0 ? MINUS : ''}${Math.abs(quantity)} ${unitLabel(unit, quantity)}`;

export const formatExpiration = (date: string | undefined): string => (date ? formatDateForDisplay(date) : 'none');

/** Local time, as the browser sees it. */
export const formatWhen = (dateTime: string): string =>
  DateTime.fromISO(dateTime).toLocal().toFormat(`${DISPLAY_DATE_FORMAT} hh:mm a`);

const ENTRY_TYPE_LABELS: Record<InventoryEntryType, string> = {
  received: 'Received',
  administered: 'Administered',
  'administration-reversed': 'Administration deleted',
  adjustment: 'Adjustment',
  count: 'Count',
};

/** The Change column: the signed quantity plus any waste the entry recorded. */
export const describeChange = (entry: InventoryHistoryEntry): string => {
  const waste = entry.components?.find((component) => component.code === 'waste-amount');
  return [formatChange(entry.quantity, entry.unit), waste ? `${waste.value} ${waste.unit} waste` : undefined]
    .filter(Boolean)
    .join(' · ');
};

/**
 * The Reason column. Receipts show that shipment's vendor (the lot's latest for entries written before it was
 * recorded per entry); counts show what was counted and expected.
 */
export const describeReason = (entry: InventoryHistoryEntry, lot: InventoryLot): string => {
  const counted = entry.components?.find((component) => component.code === 'counted')?.value;
  switch (entry.type) {
    case 'received': {
      return [ENTRY_TYPE_LABELS.received, entry.vendor ?? lot.vendor].filter(Boolean).join(' · ');
    }
    case 'count':
      if (counted === undefined) return entry.reason ? INVENTORY_ENTRY_REASON_LABELS[entry.reason] : 'Count';
      return entry.reason === 'no-difference'
        ? `${INVENTORY_ENTRY_REASON_LABELS['no-difference']} (counted ${counted})`
        : `${INVENTORY_ENTRY_REASON_LABELS['count-adjustment']} (counted ${counted}, expected ${
            counted - entry.quantity
          })`;
    case 'adjustment':
      return [entry.reason ? INVENTORY_ENTRY_REASON_LABELS[entry.reason] : ENTRY_TYPE_LABELS.adjustment, entry.note]
        .filter(Boolean)
        .join(': ');
    default:
      return entry.reason ? INVENTORY_ENTRY_REASON_LABELS[entry.reason] : ENTRY_TYPE_LABELS[entry.type];
  }
};

const MARKER_COLORS: Record<InventoryMarker, { background: string; color: string }> = {
  low: { background: otherColors.warningBackground, color: otherColors.warningText },
  expiring: { background: otherColors.warningBackground, color: otherColors.warningText },
  expired: { background: otherColors.lightErrorBg, color: otherColors.lightErrorText },
  'below-zero': { background: otherColors.lightErrorBg, color: otherColors.lightErrorText },
};

export function MarkerChips({ markers, only }: { markers: InventoryMarker[]; only?: InventoryMarker[] }): ReactElement {
  return (
    <>
      {markers
        .filter((marker) => !only || only.includes(marker))
        .map((marker) => (
          <Chip
            key={marker}
            size="small"
            label={INVENTORY_MARKER_LABELS[marker]}
            sx={{ ml: 1, height: 20, fontSize: 12, ...MARKER_COLORS[marker] }}
          />
        ))}
    </>
  );
}

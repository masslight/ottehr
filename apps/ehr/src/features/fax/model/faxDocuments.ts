import {
  FAX_DOCUMENT_LABELS,
  FAX_DOCUMENT_ORDER,
  FAX_PROGRESS_NOTE_INCLUDED_HINT,
  FAX_PROGRESS_NOTE_INCLUDED_LABELS,
  FaxDocumentAvailability,
  FaxDocumentKind,
} from 'utils';
import { FaxDocumentRow, FaxDocumentSelectionMode } from './types';

const PROGRESS_NOTE: FaxDocumentKind = 'progress-note';

export const findAvailability = (
  availability: FaxDocumentAvailability[],
  kind: FaxDocumentKind
): FaxDocumentAvailability | undefined => availability.find((entry) => entry.kind === kind);

export const isKindAvailable = (availability: FaxDocumentAvailability[], kind: FaxDocumentKind): boolean =>
  findAvailability(availability, kind)?.available ?? false;

export const availableKinds = (availability: FaxDocumentAvailability[]): FaxDocumentKind[] =>
  FAX_DOCUMENT_ORDER.filter((kind) => isKindAvailable(availability, kind));

export const defaultSelectedKinds = (availability: FaxDocumentAvailability[]): FaxDocumentKind[] =>
  availableKinds(availability);

export const buildDocumentRows = (
  availability: FaxDocumentAvailability[],
  selectedKinds: FaxDocumentKind[],
  mode: FaxDocumentSelectionMode
): FaxDocumentRow[] => {
  const rows: FaxDocumentRow[] = [];
  const allMode = mode === 'all';

  for (const kind of FAX_DOCUMENT_ORDER) {
    const entry = findAvailability(availability, kind);
    const available = entry?.available ?? false;
    const checked = available && (allMode || selectedKinds.includes(kind));

    rows.push({
      id: kind,
      label: FAX_DOCUMENT_LABELS[kind],
      kind,
      checked,
      // In "all" mode the individual boxes are a read-only preview of what will be sent.
      disabled: !available || allMode,
      hint: available ? undefined : entry?.unavailableReason,
    });

    if (kind === PROGRESS_NOTE) {
      for (const label of FAX_PROGRESS_NOTE_INCLUDED_LABELS) {
        rows.push({
          id: `${PROGRESS_NOTE}:${label}`,
          label,
          checked,
          disabled: true,
          hint: FAX_PROGRESS_NOTE_INCLUDED_HINT,
          nested: true,
        });
      }
    }
  }

  return rows;
};

/** What the request actually carries: in "all" mode everything the visit has, otherwise the ticked boxes. */
export const resolveSelection = (
  mode: FaxDocumentSelectionMode,
  availability: FaxDocumentAvailability[],
  selectedKinds: FaxDocumentKind[]
): FaxDocumentKind[] => {
  const available = availableKinds(availability);

  if (mode === 'all') {
    return available;
  }

  return available.filter((kind) => selectedKinds.includes(kind));
};

export const toggleKind = (selectedKinds: FaxDocumentKind[], kind: FaxDocumentKind): FaxDocumentKind[] =>
  selectedKinds.includes(kind)
    ? selectedKinds.filter((selected) => selected !== kind)
    : FAX_DOCUMENT_ORDER.filter((ordered) => ordered === kind || selectedKinds.includes(ordered));

export const hasNothingToSend = (availability: FaxDocumentAvailability[]): boolean =>
  availableKinds(availability).length === 0;

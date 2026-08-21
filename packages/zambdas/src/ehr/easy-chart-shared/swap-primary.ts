// Diagnosis-swap primary carry-over, server half.
//
// A review "diagnosis" or "coherence" card replaces one diagnosis with a better one: remove-diagnosis
// followed by add-diagnosis. The prompt and the schema both ask the add to restate the removed
// diagnosis's isPrimary, and the model reliably omits it — which charts the replacement as SECONDARY and
// leaves the note with NO primary whenever the swap replaced the primary diagnosis. That is
// billing-invalid, so it cannot be left to the model.
//
// Best-effort by construction: the server sees the chart only as the free-text summary the client sent,
// so the marker is read out of that text. When the diagnosis cannot be located, the action is left
// untouched and the client's structured carry-over stays authoritative.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { STRICT_ICD10 } from 'utils/lib/easy-chart/codes';

const TRAILING_CODE = new RegExp(`\\\\s*\\\\(${STRICT_ICD10.source.slice(1, -1)}\\\\)\\\\s*$`, 'i');
const LEADING_CODE = new RegExp(`^${STRICT_ICD10.source.slice(1, -1)}\\\\s*—\\\\s*`, 'i');

export function carrySwapPrimaryFromChartState(actions: PlannedAction[], chartState: string | undefined): void {
  if (!chartState) return;
  const add = actions.find((action) => action.kind === 'add-diagnosis' && typeof action.isPrimary !== 'boolean');
  const remove = actions.find((action) => action.kind === 'remove-diagnosis' && typeof action.display === 'string');
  if (!add || !remove) return;

  // The remove display arrives as "<display> (H66.003)" or "<code> — <display>", so strip either wrapper
  // and search for the bare diagnosis text.
  const display = (remove.display ?? '').replace(TRAILING_CODE, '').replace(LEADING_CODE, '').trim();
  if (!display) return;
  const index = chartState.toLowerCase().indexOf(display.toLowerCase());
  if (index < 0) return;

  // Read the marker from THIS diagnosis's own list segment: the client's summary puts every diagnosis on
  // one "Diagnoses:" line, so scanning further would pick up a neighbour's "(primary)".
  const tail = chartState.slice(index + display.length);
  const end = tail.search(/[;\n]/);
  add.isPrimary = /\(primary\)|\[PRIMARY\]/i.test(end >= 0 ? tail.slice(0, end) : tail);
}

// Ghost "+ <Label>" chips for standard vitals not yet charted on this encounter ("Option C —
// add-chips, progressive disclosure"). Clicking a chip immediately opens the vital as its own
// entry line ABOVE the chips row — the same "• Label:" line the saved VitalRow will occupy —
// using the dual-unit inline editor VitalRow's edit mode uses (VitalEntryEditor); the chip leaves
// the row while its line is open. Enter or click-away with a valid value saves through
// onSaveVital, Escape or an empty commit removes the line and the chip returns. Lets the provider
// key in simple numerics directly instead of asking the assistant to "add weight X".
// Multiple lines can be open at once (each editor's ClickAwayListener commits-or-closes it when
// the user clicks elsewhere, so in practice it converges to one open line).
import { Box, Chip } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { VitalsObservationDTO } from 'utils';
import { VitalEntryEditor } from './note-ui';
import { VITAL_LABEL } from './vitals-display';

// The always-offered standard set. Vision and LMP stay charted-only (they render as rows when
// present but get no add chip, matching today's behavior).
export const ADDABLE_VITAL_FIELDS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-blood-pressure',
  'vital-oxygen-sat',
  'vital-weight',
  'vital-height',
] as const;

export function VitalAddChips({
  vitals,
  onSaveVital,
}: {
  vitals: VitalsObservationDTO[];
  onSaveVital: (dto: VitalsObservationDTO) => void | Promise<void>;
}): JSX.Element | null {
  // Fields with an open entry line, in the order they were opened (so lines don't reorder).
  const [openFields, setOpenFields] = useState<readonly string[]>([]);
  // Optimistic in-flight guard: a just-saved field stays hidden so its chip doesn't flicker back
  // while the save + chart-data refresh round-trips. Cleared once the vital shows up in `vitals`
  // (or on save rejection, so the value can be re-entered — error surfacing is the caller's job,
  // same fire-and-forget contract as VitalRow).
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());
  const charted = useMemo(() => new Set<string>(vitals.map((v) => v.field)), [vitals]);

  useEffect(() => {
    if ([...inFlight].some((f) => charted.has(f))) {
      setInFlight((prev) => new Set([...prev].filter((f) => !charted.has(f))));
    }
  }, [charted, inFlight]);

  const missing = ADDABLE_VITAL_FIELDS.filter((f) => !charted.has(f) && !inFlight.has(f));
  if (missing.length === 0) return null;

  // An open line whose vital got charted elsewhere (e.g. by the assistant) drops silently — the
  // real row has arrived above it.
  const open = openFields.filter((f) => (missing as readonly string[]).includes(f));
  const chips = missing.filter((f) => !openFields.includes(f));

  const close = (field: string): void => setOpenFields((prev) => prev.filter((f) => f !== field));
  const save = (dto: VitalsObservationDTO): void => {
    close(dto.field);
    setInFlight((prev) => new Set(prev).add(dto.field));
    const result = onSaveVital(dto);
    if (result && typeof result.then === 'function') {
      result.then(undefined, () => setInFlight((prev) => new Set([...prev].filter((f) => f !== dto.field))));
    }
  };

  return (
    <>
      {/* Open entry lines render as their own rows here — directly under the charted vitals rows,
          in the exact "• Label:" line style the saved VitalRow will have — not inside the chips row. */}
      {open.map((field) => (
        <VitalEntryEditor
          key={field}
          field={field}
          onCommit={(dto) => (dto ? save(dto) : close(field))}
          onCancel={() => close(field)}
        />
      ))}
      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
          {chips.map((field) => (
            <Chip
              key={field}
              label={`+ ${VITAL_LABEL[field]}`}
              size="small"
              variant="outlined"
              onClick={() => setOpenFields((prev) => [...prev, field])}
              sx={{
                borderStyle: 'dashed',
                color: 'text.secondary',
                '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
              }}
            />
          ))}
        </Box>
      )}
    </>
  );
}

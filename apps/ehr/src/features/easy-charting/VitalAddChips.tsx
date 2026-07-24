// Ghost "+ <Label>" chips for standard vitals not yet charted on this encounter ("Option C —
// add-chips, progressive disclosure"). Clicking a chip swaps in the same dual-unit inline editor
// VitalRow's edit mode uses (VitalEntryEditor); Enter or blur with a valid value saves through
// onSaveVital, Escape or blur-with-empty reverts to the chip. Lets the provider key in simple
// numerics directly instead of asking the assistant to "add weight X".
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
  const [editingField, setEditingField] = useState<string | null>(null);
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

  const save = (dto: VitalsObservationDTO): void => {
    setEditingField(null);
    setInFlight((prev) => new Set(prev).add(dto.field));
    const result = onSaveVital(dto);
    if (result && typeof result.then === 'function') {
      result.then(undefined, () => setInFlight((prev) => new Set([...prev].filter((f) => f !== dto.field))));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
      {missing.map((field) =>
        editingField === field ? (
          <VitalEntryEditor
            key={field}
            field={field}
            onCommit={(dto) => (dto ? save(dto) : setEditingField(null))}
            onCancel={() => setEditingField(null)}
          />
        ) : (
          <Chip
            key={field}
            label={`+ ${VITAL_LABEL[field]}`}
            size="small"
            variant="outlined"
            onClick={() => setEditingField(field)}
            sx={{
              borderStyle: 'dashed',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          />
        )
      )}
    </Box>
  );
}

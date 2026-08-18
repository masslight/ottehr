// Typing a vital directly into the note.
//
// Vitals are not searchable the way diagnoses and medications are, so they do not go through the
// catalogue picker — they get a numeric inline editor with a box per unit and live cross-conversion,
// the same affordance the regular Vitals cards give. That is the point of the quick-add chips too: a
// simple numeric should not have to be routed through the assistant.
//
// Every box writes the SAME canonical value, so which one the provider types in is their choice and
// the chart still stores °C / kg / cm.

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { ADDABLE_VITAL_FIELDS, VITAL_LABEL, vitalEntrySpec, VitalUnitField } from 'utils/lib/easy-chart/vital-entry';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

export type VitalDraft =
  | { field: PlannableVitalField; value: number }
  | { field: 'vital-blood-pressure'; systolicPressure: number; diastolicPressure: number };

export interface VitalEntryEditorProps {
  field: PlannableVitalField;
  /** Canonical starting value, when editing a charted vital rather than adding a new one. */
  initialCanonical?: number;
  initialSystolic?: number;
  initialDiastolic?: number;
  /** Called with a draft to save, or undefined when the provider cleared it — which cancels. */
  onCommit: (draft: VitalDraft | undefined) => void;
  onCancel: () => void;
}

/** Blood pressure is two numbers, not one value in convertible units, so it has its own boxes. */
const BloodPressureBoxes: FC<{
  systolic: string;
  diastolic: string;
  onChange: (systolic: string, diastolic: string) => void;
}> = ({ systolic, diastolic, onChange }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <TextField
      size="small"
      label="systolic"
      value={systolic}
      onChange={(event) => onChange(event.target.value, diastolic)}
      sx={{ width: 100 }}
      autoFocus
    />
    <Typography>/</Typography>
    <TextField
      size="small"
      label="diastolic"
      value={diastolic}
      onChange={(event) => onChange(systolic, event.target.value)}
      sx={{ width: 100 }}
    />
    <Typography variant="caption" color="text.secondary">
      mmHg
    </Typography>
  </Stack>
);

export const VitalEntryEditor: FC<VitalEntryEditorProps> = ({
  field,
  initialCanonical,
  initialSystolic,
  initialDiastolic,
  onCommit,
  onCancel,
}) => {
  const isBloodPressure = field === VitalFieldNames.VitalBloodPressure;
  const spec = useMemo(() => vitalEntrySpec(field), [field]);

  const [systolic, setSystolic] = useState(initialSystolic != null ? String(initialSystolic) : '');
  const [diastolic, setDiastolic] = useState(initialDiastolic != null ? String(initialDiastolic) : '');
  // One canonical value behind every box, so typing in one updates the others.
  const [canonical, setCanonical] = useState<number | undefined>(initialCanonical);
  // The box being typed in keeps the provider's raw text; the others render from `canonical`. Without
  // this, typing "3" toward "38" would be re-rendered as "3" → 37.4 °F and fight the keystrokes.
  const [editing, setEditing] = useState<{ index: number; text: string } | undefined>();

  useEffect(() => {
    setCanonical(initialCanonical);
  }, [initialCanonical]);

  const boxText = (unit: VitalUnitField, index: number): string => {
    if (editing?.index === index) return editing.text;
    return canonical == null ? '' : unit.render(canonical);
  };

  const commit = (): void => {
    if (isBloodPressure) {
      const s = Number(systolic);
      const d = Number(diastolic);
      if (!Number.isFinite(s) || !Number.isFinite(d) || !systolic.trim() || !diastolic.trim()) {
        onCommit(undefined);
        return;
      }
      onCommit({ field: 'vital-blood-pressure', systolicPressure: s, diastolicPressure: d });
      return;
    }
    onCommit(canonical == null ? undefined : { field, value: spec.toStored(canonical) });
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
      <Typography variant="body2" sx={{ minWidth: 72, fontWeight: 600 }}>
        {VITAL_LABEL[field] ?? field}
      </Typography>

      {isBloodPressure ? (
        <BloodPressureBoxes
          systolic={systolic}
          diastolic={diastolic}
          onChange={(s, d) => (setSystolic(s), setDiastolic(d))}
        />
      ) : (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {spec.fields.map((unit, index) => (
            <TextField
              key={unit.label}
              size="small"
              label={unit.label}
              value={boxText(unit, index)}
              autoFocus={index === 0}
              sx={{ width: 110 }}
              onChange={(event) => {
                const text = event.target.value;
                setEditing({ index, text });
                // An unparseable box clears the value rather than keeping a stale one: committing a
                // number the provider has just typed over would chart something they did not mean.
                setCanonical(unit.parse(text));
              }}
              onBlur={() => setEditing(undefined)}
            />
          ))}
        </Stack>
      )}

      <IconButton size="small" onClick={commit} aria-label="Save vital">
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onCancel} aria-label="Cancel">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
};

export interface VitalAddChipsProps {
  charted: VitalsObservationDTO[];
  onSave: (draft: VitalDraft) => void | Promise<void>;
}

/**
 * Ghost "+ Temp" chips for the standard vitals not yet on this encounter. Clicking one opens its
 * entry line above the chips; saving removes the chip. Progressive disclosure: the affordance is
 * always there, the boxes only appear when wanted.
 */
export const VitalAddChips: FC<VitalAddChipsProps> = ({ charted, onSave }) => {
  const [open, setOpen] = useState<PlannableVitalField[]>([]);
  // A just-saved field stays hidden until the chart refetch brings it back, so its chip does not
  // flicker in and out across the round trip.
  const [inFlight, setInFlight] = useState<PlannableVitalField[]>([]);

  // Compared as plain strings: PlannableVitalField is the string subset of the VitalFieldNames enum,
  // and a Set of the enum would not accept the subset's literals.
  const chartedFields = useMemo(() => new Set<string>(charted.map((vital) => vital.field)), [charted]);

  useEffect(() => {
    setInFlight((current) => current.filter((field) => !chartedFields.has(field)));
  }, [chartedFields]);

  const missing = ADDABLE_VITAL_FIELDS.filter((field) => !chartedFields.has(field) && !inFlight.includes(field));
  const chips = missing.filter((field) => !open.includes(field));
  const openLines = open.filter((field) => missing.includes(field));

  if (missing.length === 0) return null;

  const close = (field: PlannableVitalField): void => setOpen((current) => current.filter((f) => f !== field));

  return (
    <>
      {openLines.map((field) => (
        <VitalEntryEditor
          key={field}
          field={field}
          onCommit={(draft) => {
            close(field);
            if (!draft) return;
            setInFlight((current) => [...current, field]);
            const result = onSave(draft);
            // A rejected save puts the chip back so the value can be re-entered.
            if (result && typeof (result as Promise<void>).then === 'function') {
              void (result as Promise<void>).then(undefined, () =>
                setInFlight((current) => current.filter((f) => f !== field))
              );
            }
          }}
          onCancel={() => close(field)}
        />
      ))}

      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {chips.map((field) => (
            <Chip
              key={field}
              size="small"
              variant="outlined"
              label={`+ ${VITAL_LABEL[field] ?? field}`}
              onClick={() => setOpen((current) => [...current, field])}
              sx={{ borderStyle: 'dashed' }}
            />
          ))}
        </Box>
      )}
    </>
  );
};

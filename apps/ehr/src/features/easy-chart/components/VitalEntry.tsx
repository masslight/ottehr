// The vitals ENTRY affordance: a row of ghost chips, and the Vitals page's own INPUT ROW for whichever
// one is open.
//
// The chips exist because a simple numeric should not have to be routed through the assistant — "+ HR",
// click, type, Add. What they open is deliberately NOT a form of this feature's own: it is the exact entry
// row the Vitals page renders for that vital, with its unit boxes, its qualifier dropdown, its validation
// and its save. Those know things a reimplementation forgets — °C/°F kept in step, ft'in" parsing, the
// qualifier that says how a temperature was taken, the plausibility bounds — and each of those is a wrong
// number in a chart if it is re-derived here.
//
// `variant="input"` and not the whole card: the card also carries an accordion header repeating the latest
// value and a history column repeating every reading, and the note has already stated both directly above
// the chips. Only the part a provider types into belongs here.
//
// The cards read and write through `useVitalsManagement({ encounterId })`, which is keyed by encounter
// and touches no appointment store, so it works on this route unchanged. Their read-only state comes from
// `useGetAppointmentAccessibility`, which DOES read the store — the note pane wraps them in
// `AppointmentAccessibilityOverrideProvider` so a signed visit does not render live inputs.

import { Chip, Stack } from '@mui/material';
import { FC, useState } from 'react';
import VitalsBloodPressureCard from 'src/features/visits/shared/components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from 'src/features/visits/shared/components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from 'src/features/visits/shared/components/vitals/heights/VitalsHeightCard';
import { useVitalsManagement } from 'src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import VitalsOxygenSatCard from 'src/features/visits/shared/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from 'src/features/visits/shared/components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from 'src/features/visits/shared/components/vitals/temperature/VitalsTemperaturesCard';
import VitalsWeightsCard from 'src/features/visits/shared/components/vitals/weights/VitalsWeightsCard';
import { PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { ADDABLE_VITAL_FIELDS, VITAL_LABEL } from 'utils/lib/easy-chart/vital-entry';

/**
 * Which `useVitalsManagement` field backs each chip, and which card renders it.
 *
 * Keyed by the PLAN's field names, because those are what the assistant's actions and the chart's
 * observations use — the mapping is the one place the two vocabularies meet.
 */
const CARD_FOR_FIELD: Record<
  PlannableVitalField,
  { key: 'temperature' | 'heartbeat' | 'respirationRate' | 'bloodPressure' | 'oxygenSat' | 'weight' | 'height' }
> = {
  'vital-temperature': { key: 'temperature' },
  'vital-heartbeat': { key: 'heartbeat' },
  'vital-respiration-rate': { key: 'respirationRate' },
  'vital-blood-pressure': { key: 'bloodPressure' },
  'vital-oxygen-sat': { key: 'oxygenSat' },
  'vital-weight': { key: 'weight' },
  'vital-height': { key: 'height' },
};

export interface VitalAddChipsProps {
  encounterId: string;
  /** Hidden while the visit is locked: there is nothing to add to a signed note. */
  readOnly?: boolean;
}

export const VitalAddChips: FC<VitalAddChipsProps> = ({ encounterId, readOnly }) => {
  const [open, setOpen] = useState<PlannableVitalField[]>([]);
  const vitals = useVitalsManagement({ encounterId });

  if (readOnly) return null;

  const toggle = (field: PlannableVitalField): void =>
    setOpen((current) => (current.includes(field) ? current.filter((f) => f !== field) : [...current, field]));

  return (
    <Stack spacing={1}>
      {/* The opened cards come first and the chips stay below them, so the chip a provider just clicked
          does not jump position under the cursor. */}
      {open.map((field) => (
        <VitalCard key={field} field={field} vitals={vitals} />
      ))}

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        {ADDABLE_VITAL_FIELDS.map((field) => (
          <Chip
            key={field}
            size="small"
            variant="outlined"
            label={`${open.includes(field) ? '−' : '+'} ${VITAL_LABEL[field] ?? field}`}
            onClick={() => toggle(field)}
            sx={{ borderStyle: 'dashed', cursor: 'pointer' }}
            data-testid={`easy-chart-add-${field}`}
          />
        ))}
      </Stack>
    </Stack>
  );
};

/** One vital's real card. Split out so the switch stays exhaustive over the mapping above. */
const VitalCard: FC<{
  field: PlannableVitalField;
  vitals: ReturnType<typeof useVitalsManagement>;
}> = ({ field, vitals }) => {
  switch (CARD_FOR_FIELD[field].key) {
    case 'temperature':
      return <VitalsTemperaturesCard field={vitals.fields.temperature} variant="input" />;
    case 'heartbeat':
      return <VitalsHeartbeatCard field={vitals.fields.heartbeat} variant="input" />;
    case 'respirationRate':
      return <VitalsRespirationRateCard field={vitals.fields.respirationRate} variant="input" />;
    case 'bloodPressure':
      return <VitalsBloodPressureCard field={vitals.fields.bloodPressure} variant="input" />;
    case 'oxygenSat':
      return <VitalsOxygenSatCard field={vitals.fields.oxygenSat} variant="input" />;
    case 'weight':
      return <VitalsWeightsCard field={vitals.fields.weight} variant="input" />;
    case 'height':
      return <VitalsHeightCard field={vitals.fields.height} variant="input" />;
  }
};

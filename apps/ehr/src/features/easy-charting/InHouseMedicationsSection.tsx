// In-house (administered) medications in the easy-chart note. Mirrors Review & Sign's
// InHouseMedicationsContainer: one line per MAR order via createMedicationString, plus the
// provider's in-house medication notes underneath. The orders come from a separate
// get-medication-orders query (wired in EasyChartPage — NOT part of the chart-data fetch);
// the notes arrive with chartData.notes (NOTE_TYPE.MEDICATION).
import { Stack, Typography } from '@mui/material';
import { createMedicationString, ExtendedMedicationDataForResponse, NoteDTO } from 'utils';
import { Section } from './note-ui';

export function InHouseMedicationsSection({
  medications,
  notes,
}: {
  medications: ExtendedMedicationDataForResponse[];
  notes: NoteDTO[];
}): JSX.Element {
  return (
    <Section title="In-House Medications">
      <Stack spacing={0.25}>
        {medications.map((m) => (
          <Typography key={m.id} variant="body2">
            • {createMedicationString(m)}
          </Typography>
        ))}
      </Stack>
      {notes.length > 0 && (
        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
          {notes.map((n, i) => (
            <Typography key={n.resourceId ?? i} variant="caption" color="text.secondary">
              Note: {n.text}
            </Typography>
          ))}
        </Stack>
      )}
    </Section>
  );
}

// Addenda at the very bottom of the easy-chart note, after the privacy-policy line like Review &
// Sign's AddendumCard. That card can't be reused here: its GenericNoteList reads the appointment
// store (encounter/appointment/patient resources), which the easy-chart page doesn't populate —
// it would render an infinite loader. So this is a compact READ-ONLY reimplementation over the
// same data: per-author addendum NoteDTOs (already in chartData.notes via the ADDENDUM tag of
// progressNoteChartDataRequestedFields) plus the legacy single-string addendumNote fetched
// separately in EasyChartPage. Adding/editing addenda stays in the regular chart.
import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { Section } from './note-ui';

// Soft-deleted addenda are tombstones — never shown here.
const visibleNotes = (notes: NoteDTO[]): NoteDTO[] => notes.filter((n) => !n.deleted);

export function hasAddendaToShow(notes: NoteDTO[], legacyText?: string): boolean {
  return visibleNotes(notes).length > 0 || !!legacyText;
}

export function AddendumSection({ notes, legacyText }: { notes: NoteDTO[]; legacyText?: string }): JSX.Element {
  return (
    <Section title="Addendum">
      <Stack spacing={0.75}>
        {visibleNotes(notes).map((n, i) => (
          <Stack key={n.resourceId ?? i}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {n.text}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[
                n.authorName,
                // Local timezone by design (fromISO defaults to the browser zone).
                n.lastUpdated ? DateTime.fromISO(n.lastUpdated).toFormat('MM/dd/yyyy h:mm a') : undefined,
                n.edited ? '(edited)' : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Stack>
        ))}
        {legacyText && (
          <Stack>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {legacyText}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Legacy addendum (read-only)
            </Typography>
          </Stack>
        )}
      </Stack>
    </Section>
  );
}

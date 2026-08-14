// "Additional questions" (screening) in the easy-chart note. Mirrors Review & Sign's
// AdditionalQuestionsContainer: screening-question observations keyed by
// patientScreeningQuestionsConfig, the ASQ status, and the screening NoteDTOs (which already
// arrive in the chart-data fetch via progressNoteChartDataRequestedFields.notes).
import { Stack, Typography } from '@mui/material';
import {
  formatScreeningQuestionWithNote,
  shouldDisplayScreeningQuestion,
} from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { ASQ_FIELD, ASQKeys, asqLabels } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { Section } from './note-ui';

// Question label + formatted answer rows, in config order — same selection/formatting rules as
// Review & Sign (shouldDisplayScreeningQuestion + formatScreeningQuestionWithNote).
export function buildScreeningQuestionRows(observations: ObservationDTO[] | undefined): { id: string; text: string }[] {
  return patientScreeningQuestionsConfig.fields.flatMap((field) => {
    const observation = observations?.find((obs) => obs.field === field.fhirField);
    if (!observation || !shouldDisplayScreeningQuestion((observation as { value?: unknown }).value)) return [];
    const formatted = formatScreeningQuestionWithNote(field.fhirField, observation);
    if (!formatted) return [];
    return [{ id: field.id, text: `${field.question} - ${formatted}` }];
  });
}

// Whether there's anything worth a section — any answered screening question, an ASQ status, or a
// screening note.
export function hasAdditionalQuestions(
  observations: ObservationDTO[] | undefined,
  screeningNotes: NoteDTO[] | undefined
): boolean {
  return (
    buildScreeningQuestionRows(observations).length > 0 ||
    observations?.some((obs) => obs.field === ASQ_FIELD) === true ||
    (screeningNotes?.length ?? 0) > 0
  );
}

export function AdditionalQuestionsSection({
  observations,
  screeningNotes,
}: {
  observations?: ObservationDTO[];
  screeningNotes?: NoteDTO[];
}): JSX.Element {
  const rows = buildScreeningQuestionRows(observations);
  const asqObs = observations?.find((obs) => obs.field === ASQ_FIELD);
  return (
    <Section title="Additional questions">
      <Stack spacing={0.25}>
        {rows.map((row) => (
          <Typography key={row.id} variant="body2">
            {row.text}
          </Typography>
        ))}
        {/* ASQ isn't part of the screening config yet — rendered separately, like Review & Sign. */}
        {asqObs && <Typography variant="body2">ASQ - {asqLabels[asqObs.value as ASQKeys]}</Typography>}
        {screeningNotes && screeningNotes.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Screening notes
            </Typography>
            {screeningNotes.map((note) => (
              <Typography key={note.resourceId} variant="body2">
                {note.text}
              </Typography>
            ))}
          </>
        )}
      </Stack>
    </Section>
  );
}

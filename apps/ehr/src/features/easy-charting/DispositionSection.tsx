// Display-only Disposition section for the easy-chart note (the assistant writes/edits it via
// chat — no edit/delete affordances here). Mirrors what Review & Sign's PatientInstructionsContainer
// shows for the disposition + subspecialty follow-up blocks, in the easy-chart's compact visual
// language. Rendered after Patient Instructions to match Review & Sign's Plan ordering.
import { Stack, Typography } from '@mui/material';
import {
  dispositionCheckboxOptions,
  DispositionDTO,
  followUpInOptions,
  getSpecialtyTransferDisplay,
  mapDispositionTypeToLabel,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_LABEL,
} from 'utils';
import { Section } from './note-ui';

export function DispositionSection({ disposition }: { disposition: DispositionDTO }): JSX.Element {
  const specialty = getSpecialtyTransferDisplay(disposition.specialty, disposition.specialtyOther);
  // "in 2 days" / "as needed" (value 0), like Review & Sign; falls back to a plain day count for a
  // value outside the standard options.
  const followUpIn = disposition.followUpIn;
  const followUpInLabel =
    typeof followUpIn === 'number'
      ? followUpInOptions.find((o) => o.value === followUpIn)?.label ??
        `${followUpIn} day${followUpIn === 1 ? '' : 's'}`
      : undefined;
  const subspecialtyFollowUps = (disposition.followUp ?? []).flatMap((followUp) => {
    const option = dispositionCheckboxOptions.find((o) => o.name === followUp.type);
    if (!option) return [];
    const note = followUp.type === 'other' && followUp.note ? `: ${followUp.note}` : '';
    return [{ type: followUp.type, label: `${option.label}${note}` }];
  });
  return (
    <Section title={`Disposition — ${mapDispositionTypeToLabel[disposition.type]}`}>
      <Stack spacing={0.25}>
        {specialty && <Typography variant="body2">{specialty}</Typography>}
        {disposition.note && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {disposition.note}
          </Typography>
        )}
        {disposition[NOTHING_TO_EAT_OR_DRINK_FIELD] && (
          <Typography variant="body2">{NOTHING_TO_EAT_OR_DRINK_LABEL}</Typography>
        )}
        {disposition[REFUSAL_OF_EMS_TRANSPORT_FIELD] && (
          <Typography variant="body2">{REFUSAL_OF_EMS_TRANSPORT_LABEL}</Typography>
        )}
        {disposition.labService && disposition.labService.length > 0 && (
          <Typography variant="body2">Lab Services: {disposition.labService.join(', ')}</Typography>
        )}
        {disposition.virusTest && disposition.virusTest.length > 0 && (
          <Typography variant="body2">Virus Tests: {disposition.virusTest.join(', ')}</Typography>
        )}
        {followUpInLabel !== undefined && (
          <Typography variant="body2">
            Follow-up visit {followUpIn === 0 ? followUpInLabel : `in ${followUpInLabel}`}
          </Typography>
        )}
        {disposition.reason && <Typography variant="body2">Reason for transfer: {disposition.reason}</Typography>}
        {subspecialtyFollowUps.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Subspecialty follow-up
            </Typography>
            {subspecialtyFollowUps.map((followUp) => (
              <Typography key={followUp.type} variant="body2">
                • {followUp.label}
              </Typography>
            ))}
          </>
        )}
      </Stack>
    </Section>
  );
}

import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import VitalHistoryElement from 'src/features/visits/shared/components/vitals/components/VitalsHistoryEntry';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

type PatientVitalsContainerProps = {
  notes?: NoteDTO[];
  encounterId: string | undefined;
};

// Rendered in the order the vitals are taken on the Vitals screen.
const VITAL_LABELS: [VitalFieldNames, string][] = [
  [VitalFieldNames.VitalTemperature, 'Temperature'],
  [VitalFieldNames.VitalHeartbeat, 'Heartbeat'],
  [VitalFieldNames.VitalRespirationRate, 'Respiration rate'],
  [VitalFieldNames.VitalBloodPressure, 'Blood pressure'],
  [VitalFieldNames.VitalOxygenSaturation, 'Oxygen saturation'],
  [VitalFieldNames.VitalWeight, 'Weight'],
  [VitalFieldNames.VitalHeight, 'Height'],
  [VitalFieldNames.VitalBMI, 'BMI'],
  [VitalFieldNames.VitalVision, 'Vision'],
  [VitalFieldNames.VitalLastMenstrualPeriod, 'Last Menstrual Period'],
];

export const PatientVitalsContainer: FC<PatientVitalsContainerProps> = ({ notes, encounterId }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: encounterVitals } = useGetVitals(encounterId);

  const vitalGroups = VITAL_LABELS.map(([field, label]) => ({
    label,
    entries: encounterVitals?.[field] ?? [],
  })).filter((group) => group.entries.length > 0);

  const hasNotes = !!notes?.length;

  return (
    <Stack spacing={1} sx={{ width: '100%' }} data-testid={dataTestIds.progressNotePage.vitalsContainer}>
      {!titleInCardHeader && <SectionHeading>Vitals</SectionHeading>}

      {!vitalGroups.length && !hasNotes && <Typography color="text.secondary">No vitals</Typography>}

      {vitalGroups.map((group) => (
        <Box key={group.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>{group.label}</AssessmentTitle>
          {group.entries.map((entry) => (
            <VitalHistoryElement
              dataTestId={dataTestIds.progressNotePage.vitalsItem}
              historyEntry={entry}
              key={entry.resourceId}
            />
          ))}
        </Box>
      ))}

      {notes && notes.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>Vitals notes</AssessmentTitle>
          {notes.map((note) => (
            <Typography key={note.resourceId}>{note.text}</Typography>
          ))}
        </Box>
      )}
    </Stack>
  );
};

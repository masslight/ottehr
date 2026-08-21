import { Box, Stack, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import VitalHistoryElement from 'src/features/visits/shared/components/vitals/components/VitalsHistoryEntry';
import { groupVitalsBySection } from 'src/features/visits/shared/components/vitals/groupVitalsBySection';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

type PatientVitalsContainerProps = {
  notes?: NoteDTO[];
  encounterId: string | undefined;
};

export const PatientVitalsContainer: FC<PatientVitalsContainerProps> = ({ notes, encounterId }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: encounterVitals } = useGetVitals(encounterId);

  // Config order, and anything the config does not name after it — see VITAL_SECTION_ORDER. This used to be
  // ten copies of the same block, which is how a vital ends up printed on one note and not the other.
  const groups = groupVitalsBySection(encounterVitals);

  const hasNotes = !!notes?.length;

  return (
    <Stack spacing={1} sx={{ width: '100%' }} data-testid={dataTestIds.progressNotePage.vitalsContainer}>
      {!titleInCardHeader && <SectionHeading>Vitals</SectionHeading>}

      {!groups.length && !hasNotes && <Typography color="text.secondary">No vitals</Typography>}

      {groups.map((group) => (
        <Fragment key={group.field}>
          <AssessmentTitle>{group.label}</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {group.readings.map((item) => (
              <VitalHistoryElement
                dataTestId={dataTestIds.progressNotePage.vitalsItem}
                historyEntry={item}
                key={item.resourceId}
              />
            ))}
          </Box>
        </Fragment>
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

import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../../hooks/useChartFields';
import { SectionList } from '../../SectionList';

// HPI and MOI are documented on the same screen, so they are one Review & Sign section
// with a subsection each (MOI only shows for the injury visits that have it).
export const HpiMoiContainer: FC = () => {
  const theme = useTheme();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
      mechanismOfInjury: {
        _tag: 'mechanism-of-injury',
      },
    },
  });

  // Legacy tagging: the history of present illness text is stored under the
  // chief-complaint tag.
  const historyOfPresentIllness = chartFields?.chiefComplaint?.text;
  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;

  const subSections = [
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
      data-testid={dataTestIds.progressNotePage.hpiContainer}
    >
      <AssessmentTitle>History of Present Illness</AssessmentTitle>
      {historyOfPresentIllness ? (
        <Typography sx={{ whiteSpace: 'pre-line' }}>{historyOfPresentIllness}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No history of present illness documented</Typography>
      )}
    </Box>,
    !!mechanismOfInjury && (
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        data-testid={dataTestIds.progressNotePage.moiContainer}
      >
        <AssessmentTitle>Mechanism of Injury</AssessmentTitle>
        <Typography sx={{ whiteSpace: 'pre-line' }}>{mechanismOfInjury}</Typography>
      </Box>
    ),
  ].filter(Boolean);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        HPI/MOI
      </Typography>
      <SectionList sections={subSections} sx={{ width: '100%' }} />
    </Box>
  );
};

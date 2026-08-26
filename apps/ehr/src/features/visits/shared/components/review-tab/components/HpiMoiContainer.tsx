import { Box, Stack, Typography, useTheme } from '@mui/material';
import { FC, Fragment } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { useChartFields } from '../../../hooks/useChartFields';

export const HpiMoiContainer: FC = () => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
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
      {!titleInCardHeader && <SectionHeading>HPI/MOI</SectionHeading>}
      <Stack spacing={1} sx={{ width: '100%' }}>
        {subSections.map((subSection, index) => (
          <Fragment key={index}>{subSection}</Fragment>
        ))}
      </Stack>
    </Box>
  );
};

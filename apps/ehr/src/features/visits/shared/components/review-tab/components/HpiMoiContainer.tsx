import { Box, Stack, Typography, useTheme } from '@mui/material';
import { FC, Fragment } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { formatISODateToLocaleDate } from 'src/helpers/formatDateTime';
import { useChartFields } from '../../../hooks/useChartFields';

// Matches the checkbox labels on the HPI screen's "Patient's condition related to" card.
const ACCIDENT_TYPE_LABELS: Record<string, string> = {
  AA: 'Auto Accident',
  EM: 'Employment',
  OA: 'Other Accident',
};

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
      accident: {
        _tag: 'accident',
      },
    },
  });

  // Legacy tagging: the history of present illness text is stored under the
  // chief-complaint tag.
  const historyOfPresentIllness = chartFields?.chiefComplaint?.text;
  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;

  const accident = chartFields?.accident;
  const accidentTypes = (accident?.type ?? []).map((type) => ACCIDENT_TYPE_LABELS[type] ?? type);
  const accidentDetails = [
    accident?.date ? `Date of accident: ${formatISODateToLocaleDate(accident.date) ?? accident.date}` : undefined,
    accident?.state ? `State: ${accident.state}` : undefined,
  ].filter(Boolean);

  const subSections = [
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
      data-testid={dataTestIds.progressNotePage.hpiContainer}
    >
      <AssessmentTitle>History of Present Illness</AssessmentTitle>
      {historyOfPresentIllness ? (
        <Typography sx={{ whiteSpace: 'pre-line' }}>{historyOfPresentIllness}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No history of present illness</Typography>
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
    accidentTypes.length > 0 && (
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        data-testid={dataTestIds.progressNotePage.accidentContainer}
      >
        <AssessmentTitle>Patient's condition related to</AssessmentTitle>
        <Typography>{accidentTypes.join(', ')}</Typography>
        {accidentDetails.length > 0 && <Typography>{accidentDetails.join(' · ')}</Typography>}
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

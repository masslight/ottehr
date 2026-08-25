import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getSpentTime } from 'utils/lib/fhir/encounter';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { useChartFields } from '../../../hooks/useChartFields';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';
import { SectionList } from '../../SectionList';

// Chief complaint groups everything captured on the Chief Complaint screen: the reason for
// visit the staff confirmed during the visit, and the free-text additional information.
export const ChiefComplaintContainer: FC = () => {
  const { encounter, appointment } = useAppointmentData();
  const { chartData } = useChartData();
  const theme = useTheme();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      historyOfPresentIllness: {
        _tag: 'history-of-present-illness',
      },
      reasonForVisit: {},
    },
  });

  // Legacy tagging: the "additional information" free text is stored under the
  // history-of-present-illness tag.
  const additionalInformation = chartFields?.historyOfPresentIllness?.text;
  const reasonForVisit = chartFields?.reasonForVisit?.text;
  const addToVisitNote = chartData?.addToVisitNote?.value;
  const spentTime = getSpentTime(encounter.statusHistory);

  const subSections = [
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <AssessmentTitle>Reason for visit confirmed by staff</AssessmentTitle>
      {reasonForVisit ? (
        <Typography data-testid={dataTestIds.progressNotePage.reasonForVisitConfirmed}>{reasonForVisit}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No reason for visit confirmed</Typography>
      )}
    </Box>,
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <AssessmentTitle>Additional information</AssessmentTitle>
      {additionalInformation ? (
        <Typography sx={{ whiteSpace: 'pre-line' }}>{additionalInformation}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No additional information provided</Typography>
      )}
      {isTelemedAppointment(appointment) && addToVisitNote && spentTime && (
        <Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </Typography>
      )}
    </Box>,
  ];

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Chief complaint
      </Typography>
      <SectionList sections={subSections} sx={{ width: '100%' }} />
    </Box>
  );
};

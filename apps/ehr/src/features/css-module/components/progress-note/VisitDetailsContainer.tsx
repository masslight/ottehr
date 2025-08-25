import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getProviderNameWithProfession,
  getQuestionnaireResponseByLinkId,
} from 'utils';
import { formatDateUsingSlashes } from '../../../../helpers/formatDateTime';
import { ActionsList, useAppointmentData, useChartData } from '../../../../telemed';
import { VisitNoteItem } from '../../../../telemed/features/appointment/ReviewTab';
import { ButtonRounded } from '../RoundedButton';

export const VisitDetailsContainer: FC = () => {
  const navigate = useNavigate();
  const { appointment, location, questionnaireResponse, encounter } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();

  useChartData({
    requestedFields: {
      practitioners: {},
    },
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      setPartialChartData({
        practitioners: data.practitioners,
      });
    },
  });

  const insuranceCompanyID = getQuestionnaireResponseByLinkId('insurance-carrier', questionnaireResponse)?.answer?.[0]
    .valueString;
  const subscriberID = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
    .valueString;
  const date = formatDateUsingSlashes(appointment?.start);

  const facility = location?.name;
  const admitterId = getAdmitterPractitionerId(encounter);
  const admitterPractitioner = chartData?.practitioners?.find((practitioner) => practitioner.id === admitterId);
  const admitterPractitionerName = admitterPractitioner && getProviderNameWithProfession(admitterPractitioner);

  const attenderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const attenderPractitioner = chartData?.practitioners?.find((practitioner) => practitioner.id === attenderId);
  const attenderPractitionerName = attenderPractitioner && getProviderNameWithProfession(attenderPractitioner);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          '@media (max-width: 600px)': {
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          },
        }}
      >
        <Typography fontSize={18} color="primary.dark" fontWeight={600}>
          Visit information
        </Typography>
        <ButtonRounded
          onClick={() => navigate(`/visit/${appointment?.id}`)}
          variant="outlined"
          sx={{
            whiteSpace: 'nowrap',
            '@media (max-width: 600px)': {
              alignSelf: 'flex-start',
            },
          }}
        >
          <span className="button-text">Visit Details</span>
        </ButtonRounded>
      </Box>

      <ActionsList
        data={[
          { label: 'Primary Insurance', value: insuranceCompanyID },
          { label: 'Subscriber ID', value: subscriberID },
          { label: 'Encounter Date', value: date },
          { label: 'Provider', value: attenderPractitionerName },
          { label: 'Intake completed by', value: admitterPractitionerName },
          { label: 'Appointment Facility', value: facility },
        ]}
        getKey={(item) => item.label}
        renderItem={(item) => (
          <Stack width="100%">
            <VisitNoteItem label={item.label} value={item.value} noMaxWidth />
          </Stack>
        )}
        gap={0.75}
        divider
      />
    </Stack>
  );
};

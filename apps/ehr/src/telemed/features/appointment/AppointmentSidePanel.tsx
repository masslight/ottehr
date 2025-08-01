import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Link,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { useGetErxConfigQuery } from 'src/telemed/hooks/useGetErxConfig';
import {
  calculatePatientAge,
  getQuestionnaireResponseByLinkId,
  INTERPRETER_PHONE_NUMBER,
  mapStatusToTelemed,
  TelemedAppointmentStatusEnum,
  TelemedAppointmentVisitTabs,
} from 'utils';
import { EditPatientDialog } from '../../../components/dialogs';
import { dataTestIds } from '../../../constants/data-test-ids';
import ChatModal from '../../../features/chat/ChatModal';
import { addSpacesAfterCommas } from '../../../helpers/formatString';
import { adjustTopForBannerHeight } from '../../../helpers/misc.helper';
import { getSelectors } from '../../../shared/store/getSelectors';
import CancelVisitDialog from '../../components/CancelVisitDialog';
import InviteParticipant from '../../components/InviteParticipant';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useAppointmentStore, useGetTelemedAppointmentWithSMSModel } from '../../state';
import { getAppointmentStatusChip, getPatientName, quickTexts } from '../../utils';
import { PastVisits } from './PastVisits';

enum Gender {
  'male' = 'Male',
  'female' = 'Female',
  'other' = 'Other',
  'unknown' = 'Unknown',
}

export const AppointmentSidePanel: FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const {
    appointment,
    encounter,
    patient,
    location,
    locationVirtual,
    questionnaireResponse,
    isChartDataLoading,
    chartData,
  } = getSelectors(useAppointmentStore, [
    'isChartDataLoading',
    'appointment',
    'patient',
    'encounter',
    'location',
    'locationVirtual',
    'questionnaireResponse',
    'chartData',
  ]);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);

  const { allergies } = chartData || {};

  const formattedReasonForVisit = appointment?.description && addSpacesAfterCommas(appointment.description);

  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0]?.valueString;
  const number =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString;
  const address = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const addressLine2 = getQuestionnaireResponseByLinkId('patient-street-address-2', questionnaireResponse)?.answer?.[0];

  const appointmentAccessibility = useGetAppointmentAccessibility();
  const isReadOnly = appointmentAccessibility.isAppointmentReadOnly;

  const { data: erxConfigData } = useGetErxConfigQuery();

  const isCancellableStatus =
    appointmentAccessibility.status !== TelemedAppointmentStatusEnum.complete &&
    appointmentAccessibility.status !== TelemedAppointmentStatusEnum.cancelled &&
    appointmentAccessibility.status !== TelemedAppointmentStatusEnum.unsigned;

  const isPractitionerAllowedToCancelThisVisit =
    appointmentAccessibility.isPractitionerLicensedInState &&
    appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
    isCancellableStatus;

  const { data: appointmentMessaging, isFetching } = useGetTelemedAppointmentWithSMSModel(
    {
      appointmentId: appointment?.id,
      patientId: patient?.id,
    },
    (data) => {
      setHasUnread(data.smsModel?.hasUnreadMessages || false);
    }
  );

  const [hasUnread, setHasUnread] = useState<boolean>(appointmentMessaging?.smsModel?.hasUnreadMessages || false);

  if (!patient || !locationVirtual) {
    return null;
  }

  function isSpanish(language: string): boolean {
    return language.toLowerCase() === 'Spanish'.toLowerCase();
  }

  const delimiterString = preferredLanguage && isSpanish(preferredLanguage) ? `\u00A0|\u00A0` : '';
  const interpreterString =
    preferredLanguage && isSpanish(preferredLanguage) ? `Interpreter: ${INTERPRETER_PHONE_NUMBER}` : '';

  const paperworkAllergiesYesNo = getQuestionnaireResponseByLinkId('allergies-yes-no', questionnaireResponse);

  const allergiesStatus = (): string => {
    if (isChartDataLoading) {
      return 'Loading...';
    }
    if (questionnaireResponse?.status === 'in-progress' && (allergies == null || allergies.length === 0)) {
      return 'No answer';
    }
    if (
      allergies == null ||
      allergies.length === 0 ||
      paperworkAllergiesYesNo?.answer?.[0].valueString === 'Patient has no known current allergies'
    ) {
      return 'No known allergies';
    }
    return allergies
      .filter((allergy) => allergy.current === true)
      .map((allergy) => allergy.name)
      .join(', ');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: '350px',
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: '350px',
          boxSizing: 'border-box',
          top: adjustTopForBannerHeight(-7),
          overflow: 'auto',
          '@media (max-height: 600px)': {
            overflow: 'auto',
          },
        },
      }}
    >
      <Toolbar />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, overflow: 'auto', height: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {getAppointmentStatusChip(mapStatusToTelemed(encounter.status, appointment?.status))}

            {appointment?.id && (
              <Tooltip title={appointment.id}>
                <Typography
                  sx={{
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                  variant="body2"
                >
                  VID: {appointment.id}
                </Typography>
              </Tooltip>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="h4"
              color="primary.dark"
              onClick={() => navigate(`/patient/${patient.id}`)}
              sx={{ cursor: 'pointer' }}
            >
              {getPatientName(patient.name).lastFirstMiddleName}
            </Typography>

            {!isReadOnly && (
              <IconButton
                onClick={() => setIsEditDialogOpen(true)}
                data-testid={dataTestIds.telemedEhrFlow.editPatientButtonSideBar}
              >
                <EditOutlinedIcon sx={{ color: theme.palette.primary.main }} />
              </IconButton>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Tooltip title={patient.id}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography
                sx={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                variant="body2"
              >
                ID: {patient.id}
              </Typography>
            </Box>
          </Tooltip>

          <PastVisits />

          <Typography variant="body2">{Gender[patient.gender!]}</Typography>

          <Typography variant="body2">
            DOB: {DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')}, Age:{' '}
            {calculatePatientAge(patient.birthDate!)}
          </Typography>

          <Typography variant="body2" fontWeight={500}>
            Allergies: {allergiesStatus()}
          </Typography>

          {location?.name && <Typography variant="body2">Location: {location.name}</Typography>}

          {locationVirtual && <Typography variant="body2">State: {locationVirtual?.address?.state}</Typography>}

          <Typography variant="body2">Address: {address}</Typography>

          {addressLine2 && <Typography variant="body2">Address 2: {addressLine2.valueString}</Typography>}

          <Typography variant="body2">{formattedReasonForVisit}</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, position: 'relative' }}>
          <LoadingButton
            size="small"
            variant="outlined"
            sx={{
              borderRadius: 10,
              minWidth: 'auto',
              '& .MuiButton-startIcon': {
                m: 0,
              },
            }}
            startIcon={
              hasUnread ? (
                <Badge
                  variant="dot"
                  color="warning"
                  sx={{
                    '& .MuiBadge-badge': {
                      width: '14px',
                      height: '14px',
                      borderRadius: '10px',
                      border: '2px solid white',
                      top: '-4px',
                      right: '-4px',
                    },
                  }}
                >
                  <ChatOutlineIcon />
                </Badge>
              ) : (
                <ChatOutlineIcon />
              )
            }
            onClick={() => setChatModalOpen(true)}
            loading={isFetching && !appointmentMessaging}
          />

          <Button
            size="small"
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: 10,
            }}
            startIcon={<DateRangeOutlinedIcon />}
            onClick={() => window.open('/visits/add', '_blank')}
          >
            Book visit
          </Button>

          {
            <Box sx={{ position: 'relative', zIndex: 10000 }}>
              <RoundedButton
                size="small"
                variant="outlined"
                sx={{
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: 10,
                }}
                startIcon={<MedicationOutlinedIcon />}
                onClick={() => useAppointmentStore.setState({ currentTab: TelemedAppointmentVisitTabs.plan })}
                disabled={appointmentAccessibility.isAppointmentReadOnly || !erxConfigData?.configured}
              >
                RX
              </RoundedButton>
            </Box>
          }
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box>
            <Typography variant="subtitle2" color="primary.dark">
              Preferred Language
            </Typography>
            <Typography variant="body2">
              {preferredLanguage} {delimiterString} {interpreterString}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="primary.dark">
              Hearing Impaired Relay Service? (711)
            </Typography>
            <Typography variant="body2">{relayPhone}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="primary.dark">
              Patient number
            </Typography>
            <Link sx={{ color: 'inherit' }} component={RouterLink} to={`tel:${number}`} variant="body2">
              {number}
            </Link>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
          {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
            appointmentAccessibility.status &&
            [TelemedAppointmentStatusEnum['pre-video'], TelemedAppointmentStatusEnum['on-video']].includes(
              appointmentAccessibility.status
            ) && (
              <Button
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: 10,
                }}
                startIcon={<PersonAddAltOutlinedIcon />}
                onClick={() => setIsInviteParticipantOpen(true)}
                data-testid={dataTestIds.telemedEhrFlow.inviteParticipant}
              >
                Invite participant
              </Button>
            )}
          {isPractitionerAllowedToCancelThisVisit && (
            <Button
              size="small"
              color="error"
              sx={{
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: 10,
              }}
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setIsCancelDialogOpen(true)}
              data-testid={dataTestIds.telemedEhrFlow.cancelThisVisitButton}
            >
              Cancel this visit
            </Button>
          )}
        </Box>

        {isCancelDialogOpen && <CancelVisitDialog onClose={() => setIsCancelDialogOpen(false)} />}

        {isEditDialogOpen && (
          <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
        )}
        {chatModalOpen && appointmentMessaging && (
          <ChatModal
            appointment={appointmentMessaging}
            onClose={() => setChatModalOpen(false)}
            onMarkAllRead={() => setHasUnread(false)}
            patient={patient}
            quickTexts={quickTexts}
          />
        )}
        {isInviteParticipantOpen && (
          <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
        )}
      </Box>
      <Toolbar sx={{ marginBottom: `${adjustTopForBannerHeight(0)}px` }} />
    </Drawer>
  );
};

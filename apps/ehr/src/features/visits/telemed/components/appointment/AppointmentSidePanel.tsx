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
import CancelVisitDialog from 'src/components/CancelVisitDialog';
import { EditPatientDialog } from 'src/components/dialogs';
import { RoundedButton } from 'src/components/RoundedButton';
import { TelemedAppointmentStatusChip } from 'src/components/TelemedAppointmentStatusChip';
import { dataTestIds } from 'src/constants/data-test-ids';
import ChatModal from 'src/features/chat/ChatModal';
import { getInPersonVisitDetailsUrl } from 'src/features/visits/in-person/routing/helpers';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useGetTelemedAppointmentWithSMSModel } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useAppTelemedLocalStore,
  useChartData,
} from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useGetErxConfigQuery } from 'src/features/visits/telemed/hooks/useGetErxConfig';
import { addSpacesAfterCommas } from 'src/helpers/formatString';
import { adjustTopForBannerHeight } from 'src/helpers/misc.helper';
import { useGetPatientCoverages } from 'src/hooks/useGetPatient';
import { formatLabelValue, getPatientName } from 'src/shared/utils';
import {
  calculatePatientAge,
  getInsuranceNameFromCoverage,
  getQuestionnaireResponseByLinkId,
  getTelemedVisitStatus,
  INTERPRETER_PHONE_NUMBER,
  isInPersonAppointment,
  PaymentVariant,
  TelemedAppointmentStatusEnum,
  TelemedAppointmentVisitTabs,
} from 'utils';
import { quickTexts } from '../../utils/appointments';
import { getTelemedVisitDetailsUrl } from '../../utils/routing';
import InviteParticipant from '../appointment/InviteParticipant';
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
    resources: { encounter: encounterValues },
    appointment,
    encounter,
    patient,
    location,
    locationVirtual,
    questionnaireResponse,
  } = useAppointmentData();
  const isInPerson = isInPersonAppointment(appointment);
  const { isChartDataLoading, chartData } = useChartData();
  const apiClient = useOystehrAPIClient();

  const { data: insuranceData } = useGetPatientCoverages({
    apiClient,
    patientId: patient?.id ?? null,
  });

  const paymentVariant = formatLabelValue(
    encounterValues?.payment === PaymentVariant.selfPay
      ? 'Self-pay'
      : (insuranceData?.coverages.primary && getInsuranceNameFromCoverage(insuranceData?.coverages.primary)) ??
          (insuranceData?.coverages.secondary && getInsuranceNameFromCoverage(insuranceData?.coverages.secondary))
  );

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

  const allergiesStatus = (): string => {
    if (isChartDataLoading) {
      return 'Loading...';
    }
    if (questionnaireResponse?.status === 'in-progress' && (allergies == null || allergies.length === 0)) {
      return 'No answer';
    }
    if (allergies == null || allergies.length === 0) {
      return 'No known allergies';
    }
    return allergies
      .filter((allergy) => allergy.current === true)
      .map((allergy) => allergy.name)
      .join(', ');
  };

  const telemedStatus = getTelemedVisitStatus(encounter.status, appointment?.status);

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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
            {!!telemedStatus && <TelemedAppointmentStatusChip status={telemedStatus} />}

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

            <Tooltip title={paymentVariant}>
              <Typography
                sx={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                variant="body2"
              >
                Payment: {paymentVariant}
              </Typography>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="h4"
              color="primary.dark"
              onClick={() => navigate(`/patient/${patient.id}`)}
              sx={{ cursor: 'pointer' }}
            >
              {getPatientName(patient.name).fullDisplayName}
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

        <Box sx={{ display: 'flex', gap: 1, position: 'relative', flexWrap: 'wrap' }}>
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

          {!!appointment?.id && (
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
              onClick={() =>
                isInPerson
                  ? navigate(getInPersonVisitDetailsUrl(appointment.id!))
                  : navigate(getTelemedVisitDetailsUrl(appointment.id!))
              }
            >
              Visit Details
            </Button>
          )}

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
                onClick={() => useAppTelemedLocalStore.setState({ currentTab: TelemedAppointmentVisitTabs.plan })}
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

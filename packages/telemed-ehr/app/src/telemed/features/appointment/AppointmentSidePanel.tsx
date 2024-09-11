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
import { FC, useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getQuestionnaireResponseByLinkId, mapStatusToTelemed, ApptStatus } from 'ehr-utils';
import ChatModal from '../../../features/chat/ChatModal';
import { calculatePatientAge } from '../../../helpers/formatDateTime';
import useOttehrUser from '../../../hooks/useOttehrUser';
import { getSelectors } from '../../../shared/store/getSelectors';
import CancelVisitDialog from '../../components/CancelVisitDialog';
import EditPatientDialog from '../../components/EditPatientDialog';
import InviteParticipant from '../../components/InviteParticipant';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useAppointmentStore } from '../../state';
import { getAppointmentStatusChip, getPatientName, quickTexts } from '../../utils';
// import { ERX } from './ERX';
import { PastVisits } from './PastVisits';
import { addSpacesAfterCommas } from '../../../helpers/formatString';
import { INTERPRETER_PHONE_NUMBER } from 'ehr-utils';

enum Gender {
  'male' = 'Male',
  'female' = 'Female',
  'other' = 'Other',
  'unknown' = 'Unknown',
}

export const AppointmentSidePanel: FC = () => {
  const theme = useTheme();

  const { appointment, encounter, patient, location, isReadOnly, questionnaireResponse } = getSelectors(
    useAppointmentStore,
    ['appointment', 'patient', 'encounter', 'location', 'isReadOnly', 'questionnaireResponse'],
  );

  const user = useOttehrUser();

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isERXOpen, setIsERXOpen] = useState(false);
  const [isERXLoading, setIsERXLoading] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);

  const reasonForVisit = getQuestionnaireResponseByLinkId('reason-for-visit', questionnaireResponse)?.answer?.[0]
    .valueString;
  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    .valueString;
  const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0].valueString;
  const number =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0].valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0].valueString;
  const knownAllergies = getQuestionnaireResponseByLinkId('allergies', questionnaireResponse)?.answer[0].valueArray;
  const address = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    .valueString;

  const handleERXLoadingStatusChange = useCallback<(status: boolean) => void>(
    (status) => setIsERXLoading(status),
    [setIsERXLoading],
  );
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const isCancellableStatus =
    appointmentAccessibility.status !== ApptStatus.complete &&
    appointmentAccessibility.status !== ApptStatus.cancelled &&
    appointmentAccessibility.status !== ApptStatus.unsigned;

  const isPractitionerAllowedToCancelThisVisit =
    // appointmentAccessibility.isPractitionerLicensedInState &&
    // appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
    isCancellableStatus;

  // const { data: appointmentMessaging, isFetching } = useGetTelemedAppointmentWithSMSModel(
  //   {
  //     appointmentId: appointment?.id,
  //     patientId: patient?.id,
  //   },
  //   (data) => {
  //     setHasUnread(data.smsModel?.hasUnreadMessages || false);
  //   },
  // );

  // const [hasUnread, setHasUnread] = useState<boolean>(appointmentMessaging?.smsModel?.hasUnreadMessages || false);

  if (!patient || !location) {
    return null;
  }

  const weight = patient.extension?.find(
    (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/weight',
  )?.valueString;
  const weightLastUpdated = patient.extension?.find(
    (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/weight-last-updated',
  )?.valueString;

  const weightString =
    weight &&
    weightLastUpdated &&
    `${Math.round(+weight * 0.45359237 * 100) / 100} kg (updated ${DateTime.fromFormat(
      weightLastUpdated,
      'yyyy-MM-dd',
    ).toFormat('MM/dd/yyyy')})`;

  function isSpanish(language: string): boolean {
    return language.toLowerCase() === 'Spanish'.toLowerCase();
  }

  const delimeterString = preferredLanguage && isSpanish(preferredLanguage) ? `\u00A0|\u00A0` : '';
  const interpreterString =
    preferredLanguage && isSpanish(preferredLanguage) ? `Interpreter: ${INTERPRETER_PHONE_NUMBER}` : '';

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: '350px',
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: '350px', boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, overflow: 'auto' }}>
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
            <Typography variant="h4" color="primary.dark">
              {getPatientName(patient.name).lastFirstName}
            </Typography>

            {!isReadOnly && (
              <IconButton onClick={() => setIsEditDialogOpen(true)}>
                <EditOutlinedIcon sx={{ color: theme.palette.primary.main }} />
              </IconButton>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Tooltip title={patient.id}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography variant="body2">PID:</Typography>
              <Link
                component={RouterLink}
                to={`/patient/${patient.id}`}
                target="_blank"
                sx={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  display: 'inline',
                  color: 'inherit',
                }}
                variant="body2"
              >
                {patient.id}
              </Link>
            </Box>
          </Tooltip>

          <PastVisits />

          <Typography variant="body2">{Gender[patient.gender!]}</Typography>

          <Typography variant="body2">
            DOB: {DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')}, Age:{' '}
            {calculatePatientAge(patient.birthDate!)}
          </Typography>

          {weightString && <Typography variant="body2">Wt: {weightString}</Typography>}

          {knownAllergies && (
            <Typography variant="body2" fontWeight={700}>
              Allergies: {knownAllergies.map((answer: any) => answer['allergies-form-agent-substance']).join(', ')}
            </Typography>
          )}

          <Typography variant="body2">Location: {location.address?.state}</Typography>

          <Typography variant="body2">Address: {address}</Typography>

          <Typography variant="body2">{reasonForVisit && addSpacesAfterCommas(reasonForVisit)}</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
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
            // startIcon={
            //   hasUnread ? (
            //     <Badge
            //       variant="dot"
            //       color="warning"
            //       sx={{
            //         '& .MuiBadge-badge': {
            //           width: '14px',
            //           height: '14px',
            //           borderRadius: '10px',
            //           border: '2px solid white',
            //           top: '-4px',
            //           right: '-4px',
            //         },
            //       }}
            //     >
            //       <ChatOutlineIcon />
            //     </Badge>
            //   ) : (
            //     <ChatOutlineIcon />
            //   )
            // }
            onClick={() => setChatModalOpen(true)}
            // loading={isFetching && !appointmentMessaging}
          />

          <Button
            size="small"
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: 10,
            }}
            startIcon={<DateRangeOutlinedIcon />}
            onClick={() => window.open('/visits/add', '_blank')}
          >
            Book visit
          </Button>

          {/* {user?.isPractitionerEnrolledInPhoton && (
            <LoadingButton
              size="small"
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: 10,
              }}
              startIcon={<MedicationOutlinedIcon />}
              onClick={() => setIsERXOpen(true)}
              loading={isERXLoading}
              disabled={appointmentAccessibility.isAppointmentReadOnly}
            >
              RX
            </LoadingButton>
          )} */}
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box>
            <Typography variant="subtitle2" color="primary.dark">
              Preferred Language
            </Typography>
            <Typography variant="body2">
              {preferredLanguage} {delimeterString} {interpreterString}
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
          {appointmentAccessibility.status &&
            [ApptStatus['pre-video'], ApptStatus['on-video']].includes(appointmentAccessibility.status) && (
              <Button
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: 10,
                }}
                startIcon={<PersonAddAltOutlinedIcon />}
                onClick={() => setIsInviteParticipantOpen(true)}
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
                fontWeight: 700,
                borderRadius: 10,
              }}
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setIsCancelDialogOpen(true)}
            >
              Cancel this visit
            </Button>
          )}
        </Box>

        {isCancelDialogOpen && <CancelVisitDialog onClose={() => setIsCancelDialogOpen(false)} />}
        {/* {isERXOpen && <ERX onClose={() => setIsERXOpen(false)} onLoadingStatusChange={handleERXLoadingStatusChange} />} */}
        {isEditDialogOpen && (
          <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
        )}
        {/* {chatModalOpen && appointmentMessaging && (
          <ChatModal
            appointment={appointmentMessaging}
            onClose={() => setChatModalOpen(false)}
            onMarkAllRead={() => setHasUnread(false)}
            // patient={patient}
            quickTexts={quickTexts}
          />
        )} */}
        {isInviteParticipantOpen && (
          <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
        )}
      </Box>
      <Toolbar />
    </Drawer>
  );
};

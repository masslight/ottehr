import { EditCalendarOutlined, EventBusyOutlined } from '@mui/icons-material';
import CreateOutlinedIcon from '@mui/icons-material/CreateOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Grid,
  Modal,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { ottehrLightBlue } from '@theme/icons';
import { ottehrAiLogo } from '@theme/index';
import { ContactPoint } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, ReactElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  APIError,
  APPOINTMENT_NOT_FOUND_ERROR,
  AppointmentData,
  formatPhoneNumberDisplay,
  getSelectors,
  getSlugAndStateFromLocation,
  PROJECT_NAME,
  UCGetPaperworkResponse,
  VisitType,
} from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import ottehrApi from '../api/ottehrApi';
import api from '../api/ottehrApi';
import { intakeFlowPageRoute, visitBasePath } from '../App';
import { PageContainer } from '../components';
import { dataTestIds } from '../helpers/data-test-ids';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import useAppointmentNotFoundInformation from '../helpers/information';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { breakpoints } from '../providers';

const MODAL_STYLE = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: '450px',
  border: 'none',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: '8px',
};

type AppointmentState = { appointmentData: Partial<AppointmentData> };

const APPOINTMENT_STATE_INITIAL: AppointmentState = { appointmentData: {} };

interface AppointmentStateActions {
  setState: (state: Partial<AppointmentState>) => void;
  updateAppointmentStart: (slot: string) => void;
  clear: () => void;
}

const useVisitStore = create<AppointmentState & AppointmentStateActions>()(
  persist(
    (set) => ({
      ...APPOINTMENT_STATE_INITIAL,
      setState: (state) => {
        return set({
          appointmentData: {
            ...state.appointmentData,
            appointment: state.appointmentData?.appointment ? { ...state.appointmentData.appointment } : undefined,
          },
        });
      },
      clear: () => {
        set({
          ...APPOINTMENT_STATE_INITIAL,
        });
      },
      updateAppointmentStart: (slot: string) => {
        set((state) => ({
          appointmentData: {
            ...state.appointmentData,
            appointment: state.appointmentData.appointment
              ? { ...state.appointmentData.appointment, start: slot }
              : undefined,
          },
        }));
      },
    }),
    { name: 'ip-intake-appointments-store' }
  )
);

type VisitContext = AppointmentState & Omit<AppointmentStateActions, 'clear'>;

export const useVisitContext = (): VisitContext => {
  return useOutletContext<VisitContext>();
};

export const PhoneNumberMessage: FC<{ locationTelecom?: ContactPoint[] }> = ({ locationTelecom }) => {
  const locationPhoneNumber = locationTelecom?.find((item) => item.system === 'phone')?.value;
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);
  const { t } = useTranslation();

  if (!locationPhoneNumber) {
    return null;
  }

  return !locationPhoneNumber ? null : (
    <>
      {t('thanks.callUs')}{' '}
      <strong>
        {isMobile ? (
          <a href={`tel:${locationPhoneNumber}`}>{formatPhoneNumberDisplay(locationPhoneNumber)}</a>
        ) : (
          formatPhoneNumberDisplay(locationPhoneNumber)
        )}
      </strong>
      .
    </>
  );
};

const ThankYou = (): JSX.Element => {
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [paperworkCompleted, setPaperworkCompleted] = useState<boolean>(false);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [aiChatConsentModalOpen, setAiChatConsentModalOpen] = useState<boolean>(false);
  const [aiChatStartButtonEnabled, setAiChatStartButtonEnabled] = useState<boolean>(false);
  const [aiChatStartButtonLoading, setAiChatStartButtonLoading] = useState<boolean>(false);
  const outletContext = useVisitStore();
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const shouldRenderOutlet = useMemo(() => {
    if (appointmentId && !loading) {
      return pathname.replace(appointmentId, ':id') !== visitBasePath;
    }
    return false;
  }, [appointmentId, loading, pathname]);

  const { appointmentData, clear: clearAppointmentStore } = getSelectors(useVisitStore, ['appointmentData', 'clear']);
  const { location: selectedLocation } = useMemo(() => {
    const location = appointmentData?.appointment?.location;
    if (location) {
      return { ...getSlugAndStateFromLocation(location), name: location.name, location };
    }
    return { state: undefined, slug: undefined, location };
  }, [appointmentData?.appointment?.location]);

  const visitType = useMemo(() => {
    return appointmentData?.appointment?.visitType;
  }, [appointmentData?.appointment?.visitType]);

  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const { id: appointmentID } = useParams();

  const purpleTextBoxStyling = {
    backgroundColor: otherColors.lightBlue,
    padding: 17,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 25,
  };

  // Only start tracking Thank You page after the visit type is finished loading
  useTrackMixpanelEvents({
    eventName: 'Thank You',
    visitType: visitType,
    loading: loading,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  useEffect(() => {
    async function updateData(): Promise<void> {
      if (!tokenlessZambdaClient) {
        return;
      }
      if (!appointmentID) {
        throw new Error('appointmentID is not defined');
      }

      setLoading(true);
      let paperworkResponse: UCGetPaperworkResponse | undefined = undefined;
      try {
        paperworkResponse = await ottehrApi.getPaperwork(tokenlessZambdaClient, {
          appointmentID: appointmentID,
        });
      } catch (error: any) {
        if ((error as APIError)?.code === APPOINTMENT_NOT_FOUND_ERROR.code) {
          setNotFound(true);
        } else {
          console.log('error', error);
        }
      }

      if (!paperworkResponse) {
        throw new Error('Error loading paperwork information');
      }

      const paperworkStatus = paperworkResponse.questionnaireResponse?.status;

      if (paperworkStatus === 'amended' || paperworkStatus === 'completed') {
        setPaperworkCompleted(true);
      }

      useVisitStore.setState({ appointmentData: { ...paperworkResponse } });

      setCheckedIn(paperworkResponse.appointment.status !== 'booked');
      setLoading(false);
    }

    updateData().catch((error) => {
      console.log(error);
    });
  }, [appointmentID, tokenlessZambdaClient]);

  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = appointmentData.appointment?.start;
    const timezone = appointmentData.appointment?.location.timezone ?? 'America/New_York';
    if (selectedAppointmentStart) {
      return DateTime.fromISO(selectedAppointmentStart).setZone(timezone).setLocale('en-us');
    }

    return undefined;
  }, [appointmentData.appointment?.start, appointmentData.appointment?.location?.timezone]);

  const clearState = (): void => {
    clearAppointmentStore();
  };

  const showRegisterAnotherPatient = useMemo(
    () => selectedLocation?.slug && visitType && visitType !== VisitType.PostTelemed,
    [selectedLocation?.slug, visitType]
  );

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (notFound) {
    return (
      <PageContainer title={t('paperwork.errors.notFound')} description={appointmentNotFoundInformation}>
        <></>
      </PageContainer>
    );
  }

  const buttons = (margin: number): ReactElement => {
    return (
      <Grid container alignItems="center" justifyContent="space-between" marginTop={margin} marginBottom={margin}>
        <Grid item>
          {showRegisterAnotherPatient && (
            <Link to={intakeFlowPageRoute.Homepage.path}>
              <Button variant="outlined" onClick={clearState}>
                {t('thanks.registerAnother')}
              </Button>
            </Link>
          )}
        </Grid>
        {!paperworkCompleted && (
          <Grid item>
            <Link to={`/paperwork/${appointmentID}`} className="edit-paperwork-button">
              <Button variant="contained">{t('thanks.proceedToPaperwork')}</Button>
            </Link>
          </Grid>
        )}
      </Grid>
    );
  };

  const aiChatBanner = (): ReactElement => {
    const bannerEnabled = import.meta.env.VITE_APP_AI_INTERVIEW_BANNER_ENABLED === 'true';
    return (
      <>
        {bannerEnabled && (
          <Box style={{ background: '#FFF3E0', borderRadius: '8px', padding: '24px', display: 'flex' }}>
            <Box style={{ fontWeight: 600, fontSize: '18px' }}>
              <Typography variant="subtitle1" color="text.primary" style={{ paddingBottom: '16px', fontSize: '18px' }}>
                Save time and help us prepare for your visit. Our medical chatbot will ask you a few questions and
                securely present the information to your doctor before you arrive.
              </Typography>
              <Button
                type="button"
                variant="contained"
                style={{ backgroundColor: '#F57C00' }}
                onClick={() => setAiChatConsentModalOpen(true)}
              >
                Start Chatting
              </Button>
            </Box>
            <img src={ottehrAiLogo} style={{ width: '80px', marginLeft: '8px' }} />
          </Box>
        )}
      </>
    );
  };

  if (shouldRenderOutlet) {
    console.log('rendering outlet...', pathname, visitBasePath, loading);
    return <Outlet context={{ ...outletContext }} />;
  }

  const saveAiChatConsentAndStartChat = async (): Promise<void> => {
    if (tokenlessZambdaClient == null || appointmentID == null) return;
    setAiChatStartButtonLoading(true);
    setAiChatStartButtonEnabled(false);
    await api.aIInterviewPersistConsent(
      {
        appointmentId: appointmentID,
      },
      tokenlessZambdaClient
    );
    setAiChatConsentModalOpen(false);
    navigate(intakeFlowPageRoute.AIInterview.path.replace(':id', appointmentID));
  };

  return (
    <PageContainer
      title={t('thanks.title', { PROJECT_NAME })}
      description={visitType === VisitType.WalkIn ? '' : t('thanks.subtitle')}
    >
      {(!loading && (
        <>
          {visitType !== VisitType.WalkIn && <Divider />}
          <Grid container alignItems="center" marginTop={2} marginBottom={2}>
            <Grid item xs={12} md={2.5}>
              <img src={ottehrLightBlue} alt={`${PROJECT_NAME} icon`} width="80px" />
            </Grid>
            <Grid item xs={12} md={9.5}>
              <Typography variant="subtitle1" color="text.primary">
                {t('thanks.body1')}
              </Typography>
              <Typography
                variant="h3"
                color="primary"
                mt={0.5}
                className="appointment-time"
                data-testid={dataTestIds.thankYouPageSelectedTimeBlock}
              >
                {getLocaleDateTimeString(selectedSlotTimezoneAdjusted, 'medium', i18n.language)}
              </Typography>
              <Typography
                variant="body1"
                color="primary"
                mt={0.5}
                sx={{ textDecoration: 'underline' }}
                className="appointment-description"
              >
                {selectedLocation ? `${selectedLocation?.name}` : 'Unknown'}
              </Typography>
              {!paperworkCompleted && visitType !== VisitType.WalkIn && (
                <Typography variant="body2">{t('thanks.body2')}</Typography>
              )}
            </Grid>
          </Grid>
          {visitType !== VisitType.WalkIn ? (
            <>
              {!paperworkCompleted && buttons(2)}
              <Divider sx={{ marginBottom: 2 }} />
              {paperworkCompleted && !loading && (
                <Link to={`/paperwork/${appointmentID}`}>
                  <Button sx={{ marginRight: 2 }} startIcon={<CreateOutlinedIcon />}>
                    {t('thanks.editPaperwork')}
                  </Button>
                </Link>
              )}
              {visitType !== VisitType.PostTelemed && !checkedIn && (
                <>
                  <Link to={`/visit/${appointmentID}/reschedule`}>
                    <Button startIcon={<EditCalendarOutlined />}>{t('appointments.modify')}</Button>
                  </Link>

                  <Link to="cancel">
                    <Button startIcon={<EventBusyOutlined />} sx={{ marginLeft: 2 }}>
                      {t('thanks.cancel')}
                    </Button>
                  </Link>
                </>
              )}
              <Typography variant="body2" marginTop={2}>
                {t('thanks.body3')}
              </Typography>
              {!paperworkCompleted && (
                <div style={purpleTextBoxStyling}>
                  <Typography variant="h3" color="primary" mt={0.5} className="appointment-time">
                    {t('thanks.body4')}
                  </Typography>
                  <Typography variant="body2" marginTop={2}>
                    {t('thanks.body5')}
                  </Typography>
                </div>
              )}
              <Typography variant="body2" marginTop={2}>
                <PhoneNumberMessage locationTelecom={selectedLocation?.telecom} />
              </Typography>
              {paperworkCompleted && buttons(2)}
              {paperworkCompleted && aiChatBanner()}
            </>
          ) : (
            <>
              {!paperworkCompleted && buttons(3)}
              <Divider />
              {paperworkCompleted && !loading && (
                <Link to={`/paperwork/${appointmentID}`}>
                  <Button sx={{ marginRight: 2, marginTop: 2 }} startIcon={<CreateOutlinedIcon />}>
                    {t('thanks.editPaperwork')}
                  </Button>
                </Link>
              )}
              {!paperworkCompleted ? (
                <>
                  <Box marginTop={3} sx={{ display: 'flex', alignItems: 'center' }} gap={1.5}>
                    <ErrorOutlineOutlinedIcon sx={{ color: '#FFB519' }}></ErrorOutlineOutlinedIcon>
                    <Box>
                      <Typography variant="body2">{t('thanks.body7')}</Typography>
                      <Typography>{t('thanks.body8')}</Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" marginTop={1}>
                    <PhoneNumberMessage locationTelecom={selectedLocation?.telecom} />
                  </Typography>
                </>
              ) : (
                buttons(2)
              )}
            </>
          )}
          <Modal
            open={aiChatConsentModalOpen}
            onClose={() => {
              setAiChatConsentModalOpen(false);
              setAiChatStartButtonEnabled(false);
              setAiChatStartButtonLoading(false);
            }}
          >
            <Box sx={MODAL_STYLE}>
              <Typography variant={'h2'} color="primary.main" style={{ marginBottom: '16px' }}>
                Medical History Chatbot
              </Typography>
              <Typography color="text.primary" style={{ marginBottom: '8px' }}>
                Our AI medical assistant will ask about your symptoms and medical history. Your information is
                completely private, accessible only by your doctor, and the interview helps your doctor better prepare
                for your visit.
              </Typography>
              <Typography color="text.primary">
                You can pause the interview, and then complete later. Once interview is completed, you cannot start a
                new interview.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', margin: '16px 0 16px 0' }}>
                <Checkbox color="secondary" onChange={(e) => setAiChatStartButtonEnabled(e.target.checked)} />
                <Typography color="text.primary">I consent</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setAiChatConsentModalOpen(false);
                    setAiChatStartButtonEnabled(false);
                    setAiChatStartButtonLoading(false);
                  }}
                >
                  Cancel
                </Button>
                <LoadingButton
                  loading={aiChatStartButtonLoading}
                  variant="contained"
                  color="secondary"
                  disabled={!aiChatStartButtonEnabled}
                  onClick={saveAiChatConsentAndStartChat}
                >
                  Start chat
                </LoadingButton>
              </Box>
            </Box>
          </Modal>
        </>
      )) || <CircularProgress />}
    </PageContainer>
  );
};

export default ThankYou;

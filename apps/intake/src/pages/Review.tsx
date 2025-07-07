import { EditOutlined } from '@mui/icons-material';
import { IconButton, Table, TableBody, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { APIError, APPOINTMENT_CANT_BE_IN_PAST_ERROR, ServiceMode, VisitType } from 'utils';
import { dataTestIds } from '../../src/helpers/data-test-ids';
import { ottehrApi } from '../api';
import { intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import { useIntakeCommonStore } from '../features/common';
import { NO_PATIENT_ERROR, PAST_APPT_ERROR } from '../helpers';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import { safelyCaptureException } from '../helpers/sentry';
import { useGetFullName } from '../hooks/useGetFullName';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import i18n from '../lib/i18n';
import { useBookingContext } from './BookingHome';

interface ReviewItem {
  name: string;
  valueString: string | undefined;
  testId: string;
  valueTestId?: string;
  path?: string;
}

const Review = (): JSX.Element => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const {
    patientInfo,
    unconfirmedDateOfBirth,
    visitType,
    slotId,
    scheduleOwnerName,
    scheduleOwnerType,
    scheduleOwnerId,
    timezone,
    startISO,
    serviceMode,
    originalBookingUrl,
    setPatientInfo,
    completeBooking,
  } = useBookingContext();
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const patientFullName = useGetFullName(patientInfo);
  const theme = useTheme();

  const { t } = useTranslation();

  const getNextPath = (appointmentId: string): string => {
    if (serviceMode === ServiceMode.virtual && visitType === VisitType.WalkIn) {
      return `/paperwork/${appointmentId}`;
    } else {
      return `/visit/${appointmentId}`;
    }
  };

  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const onSubmit = async (): Promise<void> => {
    try {
      if (!patientInfo) {
        console.log('no patient info error');
        safelyCaptureException(new Error('Patient not selected at appointment submit time'));
        setErrorConfig(NO_PATIENT_ERROR(t));
        return;
      }
      // Validate inputs
      if (!zambdaClient) {
        throw new Error('zambdaClient is not defined');
      }
      setLoading(true);

      // Create the appointment
      const res = await ottehrApi.createAppointment(zambdaClient, {
        slotId,
        patient: patientInfo,
        unconfirmedDateOfBirth,
        language: 'en', // replace with i18n.language to enable
      });
      const fhirAppointmentId = res.appointmentId;

      navigate(getNextPath(fhirAppointmentId));
      completeBooking();
    } catch (err) {
      if ((err as APIError)?.code === APPOINTMENT_CANT_BE_IN_PAST_ERROR.code) {
        setErrorConfig(PAST_APPT_ERROR(t));
      } else {
        // Catch validation errors
        console.error(err);
        useIntakeCommonStore.setState({ networkError: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const reviewItems: ReviewItem[] = [
    {
      name: t('reviewAndSubmit.patient'),
      valueString: patientFullName ? patientFullName : 'Unknown',
      testId: 'r&s_Patient',
      valueTestId: dataTestIds.patientNameReviewScreen,
    },
    {
      name: scheduleOwnerType,
      valueString: scheduleOwnerName,
      testId: 'r&s_ProviderType',
      valueTestId: dataTestIds.locationNameReviewScreen,
    },
  ];

  if (visitType === VisitType.PreBook) {
    let path = `${intakeFlowPageRoute.PrebookVisit.path}`;
    if (originalBookingUrl) {
      const queryChar = originalBookingUrl.includes('?') ? '&' : '?';
      path = `${originalBookingUrl}${queryChar}slot=${scheduleOwnerId}|${startISO}`;
    }
    const selectedSlotTimezoneAdjusted = DateTime.fromISO(startISO).setZone(timezone).setLocale('en-us');
    reviewItems.push({
      name: t('reviewAndSubmit.checkInTime'),
      valueString: getLocaleDateTimeString(selectedSlotTimezoneAdjusted, 'medium', i18n.language),
      path,
      testId: 'r&s_checkInTime',
      valueTestId: dataTestIds.prebookSlotReviewScreen,
    });
  } else if (visitType === VisitType.WalkIn) {
    reviewItems.push({
      name: t('reviewAndSubmit.walkInTime'),
      valueString: getLocaleDateTimeString(DateTime.now().setZone(timezone), 'medium', i18n.language),
      testId: 'r&s_walkInTime',
      valueTestId: dataTestIds.walkInSlotReviewScreen,
    });
  }

  const checkIfNew = (): void => {
    if (patientInfo?.newPatient) {
      setPatientInfo({ ...patientInfo, id: 'new-patient' });
    }
  };

  return (
    <PageContainer title={t('reviewAndSubmit.title')} description={t('reviewAndSubmit.subtitle')}>
      <Typography variant="h3" color="primary.main" marginTop={2} marginBottom={0}>
        {t('reviewAndSubmit.visitDetails')}
      </Typography>
      <Table
        sx={{
          marginBottom: 2,
          tr: {
            td: {
              borderBottom: '1px solid #E3E6EF',
            },
            '&:last-child': {
              td: {
                borderBottom: 'none',
              },
            },
          },
        }}
      >
        <TableBody>
          {reviewItems.map((item) => (
            <TableRow key={item.name}>
              <TableCell sx={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 0, paddingRight: 0 }}>
                <Typography color="secondary.main" data-testid={item.testId}>
                  {item.name}
                </Typography>
              </TableCell>
              <TableCell padding="none" align="right" data-testid={item.valueTestId}>
                {item.valueString !== undefined && item.valueString}
              </TableCell>
              <TableCell padding="none" sx={{ paddingLeft: 1 }}>
                {item.path && (
                  <Tooltip title={t('reviewAndSubmit.edit')} placement="right" className="edit-slot">
                    <Link to={item.path} state={{ reschedule: true }} onClick={checkIfNew}>
                      <IconButton aria-label="edit" color="primary">
                        <EditOutlined />
                      </IconButton>
                    </Link>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography color={theme.palette.text.secondary}>
        {t('reviewAndSubmit.byProceeding')}
        <Link to="/template.pdf" target="_blank" data-testid={dataTestIds.privacyPolicyReviewScreen}>
          {t('reviewAndSubmit.privacyPolicy')}
        </Link>{' '}
        {t('reviewAndSubmit.andPrivacyPolicy')}
        <Link to="/template.pdf" target="_blank" data-testid={dataTestIds.termsAndConditionsReviewScreen}>
          {t('reviewAndSubmit.termsAndConditions')}
        </Link>
        .
      </Typography>
      <PageForm
        controlButtons={useMemo(
          () => ({
            submitLabel:
              visitType === VisitType.PreBook ? t('reviewAndSubmit.reserveButton') : t('reviewAndSubmit.confirmButton'),
            loading: loading,
          }),
          [loading, t, visitType]
        )}
        onSubmit={onSubmit}
      />
      <ErrorDialog
        open={errorConfig != undefined}
        title={errorConfig?.title ?? ''}
        description={errorConfig?.description ?? ''}
        closeButtonText={errorConfig?.closeButtonText ?? t('reviewAndSubmit.ok')}
        handleClose={() => {
          setErrorConfig(undefined);
        }}
      />
    </PageContainer>
  );
};

export default Review;

import { EditOutlined } from '@mui/icons-material';
import { IconButton, Link as MuiLink, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ErrorDialog,
  ErrorDialogConfig,
  FormValidationErrorObject,
  PageForm,
  ReviewItem,
  getFormValidationErrors,
  getValueBoolean,
  usePaperworkContext,
} from 'ui-components';
import { ZambdaClient, useUCZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import {
  InviteParticipantRequestParameters,
  VisitType,
  makeValidationSchema,
  pickFirstValueFromAnswerItem,
  uuidRegex,
} from 'utils';
import { ValidationError } from 'yup';
import { intakeFlowPageRoute } from '../../App';
import { otherColors } from '../../IntakeThemeProvider';
import api from '../../api/zapehrApi';
import { PageContainer } from '../../components';
import ValidationErrorMessageContent from '../../features/paperwork/components/ValidationErrorMessage';
import { UNEXPECTED_ERROR_CONFIG } from '../../helpers';
import { getLocaleDateTimeString } from '../../helpers/dateUtils';
import useAppointmentNotFoundInformation from '../../helpers/information';
import { useGetFullName } from '../../hooks/useGetFullName';
import { useSetLastActiveTime } from '../../hooks/useSetLastActiveTime';
import { useTrackMixpanelEvents } from '../../hooks/useTrackMixpanelEvents';
import i18n from '../../lib/i18n';
import { useCreateInviteMutation } from '../features/waiting-room';
import { useOpenExternalLink } from '../hooks/useOpenExternalLink';
import { slugFromLinkId } from './PaperworkPage';

const ReviewPaperwork = (): JSX.Element => {
  const openExternalLink = useOpenExternalLink();
  const navigate = useNavigate();
  const { id: appointmentID } = useParams();
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(false);
  const [appointmentNotFound, setAppointmentNotFound] = useState<boolean>(false);
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const [validationErrors, setValidationErrors] = useState<FormValidationErrorObject | undefined>();
  const [errorDialogConfig, setErrorDialogConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const {
    appointment: appointmentData,
    patient: patientInfo,
    paperwork: completedPaperwork,
    pages: paperworkPages,
    findAnswerWithLinkId,
    allItems,
    questionnaireResponse,
  } = usePaperworkContext();
  const questionnaireResponseId = questionnaireResponse?.id;

  const selectedLocation = useMemo(() => {
    return appointmentData?.location;
  }, [appointmentData?.location]);
  const visitType = useMemo(() => {
    return appointmentData?.visitType;
  }, [appointmentData?.visitType]);

  const patientFullName = useGetFullName(patientInfo);

  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = appointmentData?.start;
    const timezone = appointmentData?.location.timezone ?? 'America/New_York';
    if (selectedAppointmentStart) {
      return DateTime.fromISO(selectedAppointmentStart).setZone(timezone).setLocale('en-us');
    }

    return undefined;
  }, [appointmentData?.start, appointmentData?.location?.timezone]);

  useTrackMixpanelEvents({
    eventName: 'Review Paperwork',
    visitType: visitType,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  // Update last active time for paperwork-in-progress flag every minute
  useSetLastActiveTime(appointmentID, true, zambdaClient);

  useEffect(() => {
    try {
      let errorMessage;
      if (!appointmentID) {
        errorMessage = `appointment ID missing`;
        setAppointmentNotFound(true);
      } else {
        const isUuid = appointmentID.match(uuidRegex);
        if (!isUuid) {
          errorMessage = `appointment ID is not a valid UUID`;
          setAppointmentNotFound(true);
        }
      }

      if (errorMessage) {
        throw new Error(`${errorMessage}. path: ${pathname}`);
      }
    } catch (error) {
      console.error(error);
    }
  }, [appointmentID, pathname]);

  const createInviteMutation = useCreateInviteMutation();

  const { paperworkCompletedStatus } = useMemo(() => {
    const validationSchema = makeValidationSchema(allItems);
    const validationState = (paperworkPages ?? []).reduce(
      (accum, page) => {
        accum[page.linkId] = true;
        return accum;
      },
      {} as { [pageLinkId: string]: boolean }
    );

    try {
      validationSchema.validate(completedPaperwork, { abortEarly: false });
    } catch (e) {
      const errorList =
        (e as ValidationError).inner?.map((item) => {
          return item.path?.split('.')?.[0];
        }) ?? [];
      const pagesWithError = (paperworkPages ?? [])
        .filter((page) => {
          const containsError = errorList.some((errorId) => {
            return page.item?.some((item) => {
              return item.linkId === errorId;
            });
          });
          return containsError;
        })
        .map((page) => page.linkId);
      pagesWithError.forEach((pageId) => {
        if (validationState[pageId] !== undefined) {
          validationState[pageId] = false;
        }
      });
    }
    const photoIdFront = pickFirstValueFromAnswerItem(findAnswerWithLinkId('photo-id-front'), 'attachment');
    // this is a strange one-off; it is optional in the schema but we communicate to the user that it is required
    if (photoIdFront === undefined) {
      validationState['photo-id-page'] = false;
    }
    const allComplete = Object.values(validationState).some((val) => !val) === false;
    return { paperworkCompletedStatus: validationState, allComplete };
  }, [allItems, completedPaperwork, findAnswerWithLinkId, paperworkPages]);

  const reviewItems: ReviewItem[] = [
    {
      name: 'Patient',
      valueString: patientFullName,
      hidden: !patientInfo?.firstName, // users who are not logged in will not see name
    },
    {
      name: 'Office',
      valueString: selectedLocation ? `${selectedLocation?.name}` : 'Unknown',
    },
    {
      name: 'Check-in time',
      valueString: `${getLocaleDateTimeString(selectedSlotTimezoneAdjusted, 'medium', i18n.language)}`,
      hidden: visitType === VisitType.WalkIn,
    },
    ...(paperworkPages ?? []).map((paperworkPage) => {
      let hasError = false;
      if (validationErrors) {
        hasError = validationErrors[paperworkPage.linkId]?.length ? true : false;
      }
      return {
        name: paperworkPage.text ?? 'Review',
        path: `/telemed/paperwork/${appointmentID}/${slugFromLinkId(paperworkPage.linkId)}`,
        valueBoolean: paperworkCompletedStatus[paperworkPage.linkId] && !hasError,
      };
    }),
  ];

  const navigateToWaitingRoom = useCallback(
    (error: boolean): void => {
      navigate(`${intakeFlowPageRoute.WaitingRoom.path}?appointment_id=${appointmentID}`, {
        state: { inviteErrorSnackbarOpen: error },
      });
    },
    [appointmentID, navigate]
  );

  const inviteParams = useMemo((): null | Omit<InviteParticipantRequestParameters, 'appointmentId'> => {
    const page = completedPaperwork.find((page) => page.linkId === 'invite-participant-page');

    if (!page) {
      throw new Error('invite-participant-page page not found');
    }

    const answers: { [key: string]: string | undefined } = {};

    page.item?.forEach((item) => {
      const linkId = item.linkId;
      let value: string | undefined;
      if (item?.answer?.[0]?.valueString) {
        value = item.answer[0].valueString;
      }
      answers[linkId] = value;
    });

    if (answers['invite-from-another-device'] !== 'Yes, I will add invite details below') {
      return null;
    }

    if (answers['invite-phone']) {
      answers['invite-phone'] = answers['invite-phone'].replace(/\D/g, '');
    }

    return {
      firstName: answers['invite-first']!,
      lastName: answers['invite-last']!,
      emailAddress: answers['invite-email']!,
      phoneNumber: answers['invite-phone']!,
    };
  }, [completedPaperwork]);

  const submitPaperwork = useCallback(async (): Promise<void> => {
    const submitPaperwork = async (
      data: QuestionnaireResponseItem[],
      questionnaireResponseId: string,
      zambdaClient: ZambdaClient,
      appointmentId: string
    ): Promise<void> => {
      await api.submitPaperwork(zambdaClient, { answers: data, questionnaireResponseId, appointmentId });
    };
    if (appointmentID && questionnaireResponseId && zambdaClient) {
      try {
        setLoading(true);
        try {
          await submitPaperwork([], questionnaireResponseId, zambdaClient, appointmentID);
          // update appointment status

          // telemed logic
          if (inviteParams) {
            await createInviteMutation.mutate(inviteParams, {
              onSuccess: () => {
                navigateToWaitingRoom(false);
              },
              onError: async () => {
                navigateToWaitingRoom(true);
              },
            });
          } else {
            navigateToWaitingRoom(false);
          }
        } catch (e) {
          const validationErrors = getFormValidationErrors(e);
          if (validationErrors) {
            setValidationErrors(validationErrors);
            const links = paperworkPages.reduce(
              (accum, current) => {
                if (Object.keys(validationErrors).includes(current.linkId)) {
                  accum[current.linkId] = {
                    path: `/paperwork/${appointmentID}/${slugFromLinkId(current.linkId)}`,
                    pageName: current.text ?? current.linkId,
                  };
                }
                return accum;
              },
              {} as { [pageId: string]: { path: string; pageName: string } }
            );
            setErrorDialogConfig({
              title: t('paperworkPages.validationError'),
              description: <ValidationErrorMessageContent errorObejct={validationErrors} links={links} />,
            });
          } else {
            setErrorDialogConfig(UNEXPECTED_ERROR_CONFIG(t));
          }
          return;
        }
      } catch (e) {
        // todo: handle this better, direct to page where error was found if available
        console.error('error submitting paperwork', e);
      } finally {
        setLoading(false);
      }
    }
  }, [
    appointmentID,
    questionnaireResponseId,
    zambdaClient,
    inviteParams,
    createInviteMutation,
    navigateToWaitingRoom,
    paperworkPages,
  ]);

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (appointmentNotFound) {
    return (
      <PageContainer title={t('appointment.errors.notFound')} description={appointmentNotFoundInformation}>
        <></>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('reviewAndSubmit.title')} description={t('reviewAndSubmit.subtitle')}>
      <Typography variant="h3" color="primary" marginTop={2} marginBottom={0}>
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
          {reviewItems
            .filter((reviewItem) => !reviewItem.hidden)
            .map((reviewItem) => (
              <TableRow key={reviewItem.name}>
                <TableCell
                  sx={{
                    paddingTop: 2,
                    paddingBottom: 2,
                    paddingLeft: 0,
                    paddingRight: 0,
                    color: otherColors.darkPurple,
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                >
                  {reviewItem.name === 'Complete consent forms' ? (
                    <span>{t('reviewAndSubmit.consentFormsLabel')}</span>
                  ) : reviewItem.name === 'How would you like to pay for your visit?' ? (
                    <span>{t('reviewAndSubmit.insuranceDetailsLabel')}</span>
                  ) : (
                    <span>{reviewItem.name}</span>
                  )}
                </TableCell>
                <TableCell padding="none" align="right">
                  {reviewItem.valueString !== undefined && reviewItem.valueString}
                  {reviewItem.valueBoolean !== undefined && getValueBoolean(reviewItem.valueBoolean)}
                </TableCell>
                <TableCell padding="none" sx={{ paddingLeft: 1 }}>
                  {reviewItem.path && (
                    <Tooltip title={t('reviewAndSubmit.edit')} placement="right">
                      <Link to={reviewItem.path}>
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
      <Typography variant="body2">
        By proceeding with a visit, you acknowledge that you have reviewed and accept our
        <MuiLink sx={{ cursor: 'pointer' }} onClick={() => openExternalLink('/template.pdf')} target="_blank">
          Privacy Policy
        </MuiLink>{' '}
        and{' '}
        <MuiLink sx={{ cursor: 'pointer' }} onClick={() => openExternalLink('/template.pdf')} target="_blank">
          Terms and Conditions of Service
        </MuiLink>
        .
      </Typography>
      <PageForm
        controlButtons={{
          submitLabel: 'Go to the Waiting Room',
          loading: loading,
        }}
        onSubmit={submitPaperwork}
      />
      <ErrorDialog
        open={!!errorDialogConfig}
        title={errorDialogConfig?.title || 'Error Validating Form'}
        description={errorDialogConfig?.description || ''}
        closeButtonText={t('general.button.close')}
        handleClose={() => {
          setErrorDialogConfig(undefined);
        }}
      />
    </PageContainer>
  );
};

export default ReviewPaperwork;

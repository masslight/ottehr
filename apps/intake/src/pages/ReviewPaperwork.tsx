import { EditOutlined } from '@mui/icons-material';
import { IconButton, Link as MuiLink, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorDialog, ErrorDialogConfig, getValueBoolean, PageForm, ReviewItem } from 'ui-components';
import { useUCZambdaClient, ZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import { makeValidationSchema, pickFirstValueFromAnswerItem, ServiceMode, uuidRegex, VisitType } from 'utils';
import { ValidationError } from 'yup';
import { dataTestIds } from '../../src/helpers/data-test-ids';
import api from '../api/ottehrApi';
import { intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import ValidationErrorMessageContent from '../features/paperwork/components/ValidationErrorMessage';
import { UNEXPECTED_ERROR_CONFIG } from '../helpers';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import useAppointmentNotFoundInformation from '../helpers/information';
import { useGetFullName } from '../hooks/useGetFullName';
import { usePaperworkInviteParams } from '../hooks/usePaperworkInviteParams';
import { otherColors } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { useCreateInviteMutation } from '../telemed/features/waiting-room';
import { useOpenExternalLink } from '../telemed/hooks/useOpenExternalLink';
import { slugFromLinkId } from './PaperworkPage';
import { useAppointmentStore } from '../telemed/features/appointments/appointment.store';
import { FormValidationErrorObject, usePaperworkContext, getFormValidationErrors } from 'src/features/paperwork';

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

  useEffect(() => {
    if (appointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID }));
    }
  }, [appointmentID]);

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

  const inviteParams = usePaperworkInviteParams(completedPaperwork);

  const navigateToWaitingRoom = useCallback(
    (error: boolean): void => {
      navigate(`/visit/${appointmentID}`, {
        state: { inviteErrorSnackbarOpen: error },
      });
    },
    [appointmentID, navigate]
  );
  const navigateToVirtualWaitingRoom = useCallback(
    (error: boolean): void => {
      navigate(`${intakeFlowPageRoute.WaitingRoom.path}?appointment_id=${appointmentID}`, {
        state: { inviteErrorSnackbarOpen: error },
      });
    },
    [appointmentID, navigate]
  );

  const { paperworkCompletedStatus, allComplete } = useMemo(() => {
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
      console.log('errorList', errorList, e);
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
      console.log('pagesWithError', pagesWithError);
    }
    const photoIdFront = pickFirstValueFromAnswerItem(findAnswerWithLinkId('photo-id-front'), 'attachment');
    console.log('photoIdFront', photoIdFront, findAnswerWithLinkId('photo-id-front'));
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
      testId: dataTestIds.patientNamePaperworkReviewScreen,
    },
    {
      name: 'Location',
      valueString: selectedLocation ? `${selectedLocation?.name}` : 'Unknown',
      testId: dataTestIds.locationNamePaperworkReviewScreen,
    },
    {
      name: 'Check-in time',
      valueString: `${getLocaleDateTimeString(selectedSlotTimezoneAdjusted, 'medium', i18n.language)}`,
      hidden: visitType === VisitType.WalkIn,
      testId: dataTestIds.checkInTimePaperworkReviewScreen,
    },
    ...(paperworkPages ?? []).map((paperworkPage) => {
      let hasError = false;
      if (validationErrors) {
        hasError = validationErrors[paperworkPage.linkId]?.length ? true : false;
      }
      return {
        name: paperworkPage.text ?? 'Review',
        path: `/paperwork/${appointmentID}/${slugFromLinkId(paperworkPage.linkId)}`,
        valueBoolean: paperworkCompletedStatus[paperworkPage.linkId] && !hasError,
        testId: paperworkPage.linkId + '-status',
        rowID: paperworkPage.linkId,
        valueTestId: paperworkPage.linkId + '-edit',
      };
    }),
  ];

  const serviceMode = appointmentData?.serviceMode ?? ServiceMode['in-person'];
  const submitButtonLabel: string = (() => {
    if (serviceMode === ServiceMode['in-person'] || visitType === VisitType.PreBook) {
      return allComplete ? t('reviewAndSubmit.finish') : t('reviewAndSubmit.saveAndFinish');
    } else {
      return 'Go to the Waiting Room';
    }
  })();

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
          // try to find out a better way of modeling when appointment id is/isn't needed when consolidating
          // this with the telemed code
          await submitPaperwork([], questionnaireResponseId, zambdaClient, appointmentID);
        } catch (e) {
          const validationErrors = getFormValidationErrors(e);
          if (validationErrors) {
            console.log('validation errors returned: ', validationErrors);
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
              description: <ValidationErrorMessageContent errorObject={validationErrors} links={links} />,
            });
          } else {
            setErrorDialogConfig(UNEXPECTED_ERROR_CONFIG(t));
          }
          return;
        }
        if (visitType === VisitType.WalkIn) {
          if (serviceMode === ServiceMode['virtual']) {
            // navigate to waiting room
            if (inviteParams) {
              createInviteMutation.mutate(inviteParams, {
                onSuccess: () => {
                  navigateToVirtualWaitingRoom(false);
                },
                onError: async () => {
                  navigateToVirtualWaitingRoom(true);
                },
              });
            } else {
              navigateToVirtualWaitingRoom(false);
            }
          } else {
            navigate(`/visit/${appointmentID}/check-in`);
          }
        } else {
          // telemed logic
          if (inviteParams) {
            createInviteMutation.mutate(inviteParams, {
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
    visitType,
    serviceMode,
    paperworkPages,
    navigate,
    inviteParams,
    createInviteMutation,
    navigateToWaitingRoom,
    navigateToVirtualWaitingRoom,
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
              <TableRow key={reviewItem.name} data-testid={reviewItem.rowID}>
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
                <TableCell padding="none" align="right" data-testid={reviewItem.testId}>
                  {reviewItem.valueString !== undefined && reviewItem.valueString}
                  {reviewItem.valueBoolean !== undefined && getValueBoolean(reviewItem.valueBoolean)}
                </TableCell>
                <TableCell padding="none" sx={{ paddingLeft: 1 }}>
                  {reviewItem.path && (
                    <Tooltip title={t('reviewAndSubmit.edit')} placement="right">
                      <Link to={reviewItem.path}>
                        <IconButton aria-label="edit" color="primary" data-testid={reviewItem.valueTestId}>
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
        By proceeding with a visit, you acknowledge that you have reviewed and accept our{' '}
        <MuiLink
          sx={{ cursor: 'pointer' }}
          onClick={() => openExternalLink('/template.pdf')}
          target="_blank"
          data-testid={dataTestIds.privacyPolicyReviewScreen}
        >
          Privacy Policy
        </MuiLink>{' '}
        and{' '}
        <MuiLink
          sx={{ cursor: 'pointer' }}
          onClick={() => openExternalLink('/template.pdf')}
          target="_blank"
          data-testid={dataTestIds.termsAndConditionsReviewScreen}
        >
          Terms and Conditions of Service
        </MuiLink>
        .
      </Typography>
      <PageForm
        controlButtons={{
          submitLabel: submitButtonLabel,
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

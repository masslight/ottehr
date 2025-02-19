import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Link as MUILink } from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorDialog, PaperworkContext, usePaperworkContext } from 'ui-components';
import { CustomContainer } from '../features/common';
import {
  formatPhoneNumberDisplay,
  getSelectors,
  isApiError,
  APIError,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  uuidRegex,
  APPOINTMENT_NOT_FOUND_ERROR,
  IntakeQuestionnaireItem,
  UCGetPaperworkResponse,
  PaperworkPatient,
  flattenIntakeQuestionnaireItems,
  QuestionnaireFormFields,
  findQuestionnaireResponseItemLinkId,
} from 'utils';
import { useAuth0 } from '@auth0/auth0-react';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { t } from 'i18next';
import { usePreserveQueryParams } from '../hooks/usePreserveQueryParams';
import { useGetFullName } from '../hooks/useGetFullName';
import { useZapEHRAPIClient } from '../utils';
import useAppointmentNotFoundInformation from '../hooks/useAppointmentNotFoundInformation';
import ConfirmDateOfBirthForm from '../components/ConfirmDateOfBirthForm';
import PagedQuestionnaire from '../../features/paperwork/PagedQuestionnaire';
import { usePaperworkStore } from '../../pages/PaperworkPage';

enum ChallengeLoadingState {
  initial,
  loading,
  complete,
  failed,
}
enum AuthedLoadingState {
  initial,
  loading,
  complete,
  noReadAcces,
}

export const PaperworkHome: FC = () => {
  const [appointmentNotFound, setAppointmentNotFound] = useState<boolean>(false);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth0();
  const { id: appointmentId } = useParams();
  const { pathname } = useLocation();
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  const [challengeFetchState, setChallengeFetchState] = useState(ChallengeLoadingState.initial);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);
  const apiClient = useZapEHRAPIClient();

  const {
    paperworkInProgress,
    paperworkResponse,
    updateTimestamp,
    setResponse,
    clear: clearPaperworkState,
  } = getSelectors(usePaperworkStore, [
    'paperworkInProgress',
    'setResponse',
    'paperworkResponse',
    'clear',
    'updateTimestamp',
  ]);

  const { allItems, questionnaireResponse, appointment, patient } = useMemo(() => {
    if (paperworkResponse === undefined) {
      return {
        allItems: [] as IntakeQuestionnaireItem[],
        questionnaireResponse: undefined,
        appointment: undefined,
        patien: undefined,
      };
    } else {
      const { allItems, questionnaireResponse, appointment, patient } = paperworkResponse;
      return {
        allItems: allItems ?? [],
        questionnaireResponse,
        appointment,
        patient,
      };
    }
  }, [paperworkResponse]);

  useEffect(() => {
    if (!isAuthenticated && !authIsLoading) {
      clearPaperworkState();
    }
  }, [authIsLoading, authedFetchState, clearPaperworkState, isAuthenticated]);

  useEffect(() => {
    if (appointmentId && appointment?.id && appointmentId !== appointment?.id) {
      clearPaperworkState();
    }
  }, [appointment?.id, appointmentId, clearPaperworkState]);

  useEffect(() => {
    // todo: better typing
    const fetchAuthedPaperwork = async (apptId: string, apiClient: any): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const paperworkResponse = await apiClient.getPaperwork({
          appointmentID: apptId,
        });
        setResponse(paperworkResponse);
        setAuthedFetchState(AuthedLoadingState.complete);
      } catch (e) {
        if (isApiError(e)) {
          const apiError = e as APIError;
          if (apiError.code === NO_READ_ACCESS_TO_PATIENT_ERROR.code) {
            setAuthedFetchState(AuthedLoadingState.noReadAcces);
          } else {
            setAuthedFetchState(AuthedLoadingState.complete);
          }
        }
      }
    };
    if (isAuthenticated && apiClient && authedFetchState === AuthedLoadingState.initial && appointmentId) {
      void fetchAuthedPaperwork(appointmentId, apiClient);
    }
  }, [isAuthenticated, authedFetchState, setResponse, setAuthedFetchState, appointmentId, apiClient]);

  useEffect(() => {
    try {
      let errorMessage;
      if (!appointmentId) {
        errorMessage = `appointment ID missing`;
        setAppointmentNotFound(true);
      } else {
        const isUuid = appointmentId.match(uuidRegex);
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
  }, [appointmentId, pathname]);

  useEffect(() => {
    if (appointmentId && appointment?.id && appointmentId !== appointment.id) {
      clearPaperworkState();
    }
  }, [appointmentId, appointment?.id, clearPaperworkState]);

  const selectedLocation = useMemo(() => {
    return appointment?.location;
  }, [appointment?.location]);
  const phoneNumber = useMemo(() => {
    return selectedLocation?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  }, [selectedLocation?.telecom]);

  const completedPaperwork: QuestionnaireResponseItem[] = useMemo(() => {
    return questionnaireResponse?.item ?? [];
  }, [questionnaireResponse?.item]);

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  const outletContext: PaperworkContext = useMemo(() => {
    return {
      appointment,
      paperwork: completedPaperwork,
      paperworkInProgress,
      pageItems: allItems,
      allItems: flattenIntakeQuestionnaireItems(allItems ?? []),
      pages,
      questionnaireResponse,
      patient,
      updateTimestamp,
      saveButtonDisabled,
      setSaveButtonDisabled,
      findAnswerWithLinkId: (linkId: string): QuestionnaireResponseItem | undefined => {
        return findQuestionnaireResponseItemLinkId(linkId, completedPaperwork);
      },
    };
  }, [
    appointment,
    completedPaperwork,
    paperworkInProgress,
    allItems,
    pages,
    questionnaireResponse,
    patient,
    updateTimestamp,
    saveButtonDisabled,
  ]);

  const renderChallenge = useMemo(() => {
    const pathOne = !isAuthenticated && challengeFetchState !== ChallengeLoadingState.complete;

    const pathTwo =
      (isAuthenticated || authIsLoading) &&
      challengeFetchState !== ChallengeLoadingState.complete &&
      authedFetchState === AuthedLoadingState.noReadAcces;
    return pathOne || pathTwo;
  }, [authIsLoading, authedFetchState, challengeFetchState, isAuthenticated]);

  const redirectTarget = useMemo(() => {
    if (
      pages &&
      pages.length &&
      (authedFetchState === AuthedLoadingState.complete || challengeFetchState === ChallengeLoadingState.complete)
    ) {
      const firstPage = pages[0].linkId.replace('-page', '');
      if (pathname === `/telemed/paperwork/${appointmentId}`) {
        return `/telemed/paperwork/${appointmentId}/${firstPage}`;
      }
    }
    return undefined;
  }, [appointmentId, authedFetchState, challengeFetchState, pathname, pages]);

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (appointmentNotFound) {
    return (
      <CustomContainer title={t('paperwork.errors.notFound')} description={appointmentNotFoundInformation}>
        <></>
      </CustomContainer>
    );
  }

  if (
    (isAuthenticated || authIsLoading) &&
    (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading)
  ) {
    return (
      <CustomContainer title={t('paperwork.loading')}>
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </CustomContainer>
    );
  }
  if (redirectTarget) {
    return <Navigate to={redirectTarget} replace={true} />;
  }
  if (renderChallenge) {
    return (
      <DOBChallengeSubcomponent
        phoneNumber={phoneNumber}
        patientInfo={patient}
        setAppointmentNotFound={setAppointmentNotFound}
        challengeFetchState={challengeFetchState}
        setChallengeFetchState={setChallengeFetchState}
        setResponse={setResponse}
        authedRequestIsLoading={
          authedFetchState === AuthedLoadingState.loading ||
          (isAuthenticated && authedFetchState === AuthedLoadingState.initial)
        }
      />
    );
  } else {
    return <Outlet context={{ ...outletContext }} />;
  }
};

interface DOBChallengeSubcomponentProps {
  phoneNumber: string | undefined;
  patientInfo: PaperworkPatient | undefined;
  authedRequestIsLoading: boolean;
  challengeFetchState: ChallengeLoadingState;
  setChallengeFetchState: (cfs: ChallengeLoadingState) => void;
  setAppointmentNotFound: (notFound: boolean) => void;
  setResponse: (response: UCGetPaperworkResponse, method: 'challenge' | 'token') => void;
}
const DOBChallengeSubcomponent: FC<DOBChallengeSubcomponentProps> = ({
  phoneNumber,
  authedRequestIsLoading,
  challengeFetchState,
  patientInfo,
  setChallengeFetchState,
  setAppointmentNotFound,
  setResponse,
}) => {
  const { id: appointmentID } = useParams();
  // const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { isLoading: authLoading } = useAuth0();
  const preserveQueryParams = usePreserveQueryParams();

  const { loginWithRedirect } = useAuth0();
  const apiClient = useZapEHRAPIClient();

  const fetchPaperworkWithChallenge = useCallback(
    async (dateOfBirth: string): Promise<void> => {
      if (!appointmentID || !apiClient) {
        return;
      }
      try {
        setChallengeFetchState(ChallengeLoadingState.loading);
        // todo: will this just fail because this endpoint is ident
        const paperworkResponse = await apiClient.getPaperwork({
          appointmentID,
          dateOfBirth,
        });
        setResponse(paperworkResponse, 'challenge');
        setChallengeFetchState(ChallengeLoadingState.complete);
      } catch (e) {
        const error = e as any;
        if ((error as APIError)?.code === APPOINTMENT_NOT_FOUND_ERROR.code) {
          setAppointmentNotFound(true);
        }
        // todo: error handling
        console.log('error fetching challenge', e);
        setChallengeFetchState(ChallengeLoadingState.failed);
      }
    },
    [apiClient, appointmentID, setAppointmentNotFound, setChallengeFetchState, setResponse]
  );

  const isLoading = useMemo(() => {
    return challengeFetchState === ChallengeLoadingState.loading || authLoading || authedRequestIsLoading;
  }, [challengeFetchState, authLoading, authedRequestIsLoading]);

  const loginToPaperwork = (): void => {
    loginWithRedirect({
      authorizationParams: {
        redirectUri: preserveQueryParams(`${window.location.origin}/redirect`),
        appState: {
          target: `/telemed/paperwork/${appointmentID}`,
        },
      },
    }).catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
    });
  };

  return (
    <CustomContainer
      title={
        isLoading
          ? t('paperwork.loading')
          : `${t('paperwork.confirmPatient.confirm')} ${
              patientInfo?.firstName
                ? `${patientInfo?.firstName}${t('paperwork.confirmPatient.knownPatient')}`
                : t('paperwork.confirmPatient.unknownPatient')
            } ${t('paperwork.confirmPatient.dob')}`
      }
    >
      {isLoading ? (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <ConfirmDateOfBirthForm
          patientInfo={undefined}
          description={
            <Typography variant="body1">
              {t('paperwork.logInToAccount.or')}{' '}
              <MUILink onClick={loginToPaperwork} sx={{ cursor: 'pointer' }}>
                {t('paperwork.logInToAccount.logIn')}
              </MUILink>{' '}
              {t('paperwork.logInToAccount.toAccount')}
            </Typography>
          }
          required={true}
          loading={challengeFetchState === ChallengeLoadingState.loading}
          dobConfirmed={challengeFetchState === ChallengeLoadingState.failed ? false : undefined}
          onConfirmedSubmit={async (confirmedDateOfBirth: string): Promise<void> => {
            await fetchPaperworkWithChallenge(confirmedDateOfBirth);
          }}
          wrongDateOfBirthModal={{
            buttonText: 'Log in',
            message: (
              <>
                <Typography marginTop={2}>{t('paperwork.errors.wrongDob.wrongDob1')}</Typography>
                {phoneNumber && (
                  <Typography marginTop={2}>
                    {t('paperwork.errors.wrongDob.wrongDob2')} {formatPhoneNumberDisplay(phoneNumber)}{' '}
                    {t('paperwork.errors.wrongDob.wrongDob3')}
                  </Typography>
                )}
              </>
            ),
            onSubmit: loginToPaperwork,
          }}
        />
      )}
    </CustomContainer>
  );
};

export const PaperworkPage: FC = () => {
  // const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: appointmentID, slug } = useParams();
  // const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const [fileErrorDialogOpen, setFileErrorDialogOpen] = useState<boolean>(false);
  const patchCompletedPaperwork = usePaperworkStore((state) => {
    return state.patchCompletedPaperwork;
  });
  const saveProgress = usePaperworkStore((state) => {
    return state.saveProgress;
  });
  const {
    paperwork: completedPaperwork,
    paperworkInProgress,
    questionnaireResponse,
    pages: paperworkPages,
    patient: paperworkPatient,
  } = usePaperworkContext();

  const questionnaireResponseId = questionnaireResponse?.id;

  const apiClient = useZapEHRAPIClient();

  // this is just for avoiding duplicates in the mixpanel tracking
  const [lastLoggedPageName, setLastLoggedPageName] = useState<string>();

  const patientFullName = useGetFullName(paperworkPatient);

  const { nextPage, pageName, currentPage, currentIndex, empty, questionnaireItems } = useMemo(() => {
    const empty = {
      items: [],
      nextPage: undefined,
      pageName: undefined,
      currentPage: undefined,
      currentIndex: undefined,
      empty: true,
      questionnaireItems: [],
    };
    if (!paperworkPages) {
      return empty;
    }
    const currentPage = paperworkPages.find((pageTemp) => slugFromLinkId(pageTemp.linkId) === slug);
    if (!currentPage) {
      return empty;
    }

    const pageName = currentPage.text;
    const questionnaireItems = currentPage.item ?? [];
    const currentIndex = paperworkPages.findIndex((pageTemp) => pageTemp.linkId === currentPage.linkId);
    const nextPage = paperworkPages[currentIndex + 1];
    return { nextPage, pageName, currentPage, currentIndex, empty: false, questionnaireItems };
  }, [paperworkPages, slug]);

  useEffect(() => {
    if (pageName !== lastLoggedPageName) {
      setLastLoggedPageName(pageName);
    }
  }, [lastLoggedPageName, pageName]);

  const [loading, setLoading] = useState<boolean>(false);

  const controlButtons = useMemo(
    () => ({
      backButton: currentIndex !== 0,
      loading: loading,
      onBack: () => {
        navigate(-1);
      },
    }),
    [currentIndex, loading, navigate]
  );

  const paperworkGroupDefaults = useMemo(() => {
    const currentPageFields = (currentPage?.item ?? []).reduce((accum, item) => {
      if (item.type !== 'display') {
        accum[item.linkId] = { linkId: item.linkId };
      }
      return accum;
    }, {} as any);
    const currentPageEntries = completedPaperwork.find((item) => item.linkId === currentPage?.linkId)?.item;
    const inProgress = paperworkInProgress[currentPage?.linkId ?? ''] ?? {};
    if (!currentPageEntries && !inProgress) {
      return { ...currentPageFields };
    }

    const pageDefaults = (currentPageEntries ?? []).reduce((accum, entry) => {
      accum[entry.linkId] = { ...entry };
      return accum;
    }, {} as QuestionnaireFormFields);

    return { ...currentPageFields, ...pageDefaults, ...inProgress };
  }, [completedPaperwork, currentPage, paperworkInProgress]);

  const finishPaperworkPage = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      const patchPaperwork = async (
        data: QuestionnaireResponseItem[],
        questionnaireResponseId: string,
        pageId: string,
        apiClient: any // todo
      ): Promise<QuestionnaireResponse> => {
        return apiClient.patchPaperwork({
          answers: { linkId: pageId, item: data },
          questionnaireResponseId,
        });
      };

      if (data && appointmentID && currentPage && apiClient && questionnaireResponseId) {
        const raw = (Object.values(data) ?? []) as QuestionnaireResponseItem[];
        const responseItems = raw
          .filter((item) => {
            if (item.linkId === undefined || (item.answer === undefined && item.item === undefined)) {
              return false;
            }
            return true;
          })
          .map((item) => {
            // for some reason group items are getting "answer: [null]""
            if (!item?.answer?.[0]) {
              return { ...item, answer: undefined };
            }
            return item;
          });
        try {
          setLoading(true);
          const updatedPaperwork = await patchPaperwork(
            responseItems,
            questionnaireResponseId,
            currentPage.linkId,
            apiClient
          );
          patchCompletedPaperwork(updatedPaperwork);
          saveProgress(currentPage.linkId, undefined);
          const slug = nextPage !== undefined ? slugFromLinkId(nextPage.linkId) : 'review';
          navigate(`/telemed/paperwork/${appointmentID}/${slug}`);
        } catch (e) {
          // todo: handle this better
          console.error('error patching paperwork', e);
        } finally {
          setLoading(false);
        }
      }
    },
    [
      appointmentID,
      questionnaireResponseId,
      currentPage,
      apiClient,
      patchCompletedPaperwork,
      saveProgress,
      navigate,
      nextPage,
    ]
  );

  return (
    <CustomContainer title={pageName ?? ''} patientFullName={patientFullName}>
      {empty ? (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box> // can we do something better than an infinite loader here
      ) : (
        <>
          <PagedQuestionnaire
            onSubmit={finishPaperworkPage}
            pageId={currentPage?.linkId ?? ''}
            options={{ controlButtons }}
            items={questionnaireItems}
            defaultValues={paperworkGroupDefaults}
            saveProgress={(data) => {
              const pageId = currentPage?.linkId;
              if (pageId) {
                saveProgress(pageId, data);
              }
            }}
          />
          <ErrorDialog
            open={fileErrorDialogOpen}
            title={t('paperwork.errors.file.title')}
            description={t('paperwork.errors.file.description')}
            closeButtonText={t('paperwork.errors.file.close')}
            handleClose={() => setFileErrorDialogOpen(false)}
          />
        </>
      )}
    </CustomContainer>
  );
};

export const slugFromLinkId = (linkId: string): string => {
  return linkId.replace('-page', '');
};

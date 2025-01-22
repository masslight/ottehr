import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { ErrorDialog, PaperworkContext, usePaperworkContext } from 'ui-components';
import {
  getSelectors,
  isApiError,
  APIError,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  uuidRegex,
  UCGetPaperworkResponse,
  IntakeQuestionnaireItem,
  flattenIntakeQuestionnaireItems,
  QuestionnaireFormFields,
  findQuestionnaireResponseItemLinkId,
} from 'utils';
import { zapehrApi } from '../api';
import useAppointmentNotFoundInformation from '../helpers/information';
import { PageContainer } from '../components';
import { useSetLastActiveTime } from '../hooks/useSetLastActiveTime';
import { useAuth0 } from '@auth0/auth0-react';
import { persist } from 'zustand/middleware';
import { DateTime } from 'luxon';
import { ZambdaClient, useUCZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import { useGetFullName } from '../hooks/useGetFullName';
import api from '../api/zapehrApi';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { t } from 'i18next';
import PagedQuestionnaire from '../features/paperwork/PagedQuestionnaire';

enum AuthedLoadingState {
  initial,
  loading,
  complete,
  noReadAccess,
}

type PaperworkState = {
  updateTimestamp: number | undefined;
  paperworkInProgress: { [pageId: string]: QuestionnaireFormFields };
  paperworkResponse: UCGetPaperworkResponse | undefined;
};

interface PaperworkStateActions {
  setResponse: (response: UCGetPaperworkResponse) => void;
  saveProgress: (pageId: string, responses: any) => void;
  patchCompletedPaperwork: (QR: QuestionnaireResponse) => void;
  clear: () => void;
}

const PAPERWORK_STATE_INITIAL: PaperworkState = {
  updateTimestamp: undefined,
  paperworkInProgress: {},
  paperworkResponse: undefined,
};

export const usePaperworkStore = create<PaperworkState & PaperworkStateActions>()(
  persist(
    (set) => ({
      ...PAPERWORK_STATE_INITIAL,
      setResponse: (response: UCGetPaperworkResponse) => {
        set((state) => {
          // console.log('response.paperwork', response.paperwork);
          // console.log('state.paperwork', state.paperwork);
          return {
            ...state,
            paperworkResponse: response,
          };
        });
      },
      saveProgress: (pageId: string, responses: any) => {
        const updateDT = DateTime.now().toSeconds();
        set((state) => {
          const pIP = { ...(state.paperworkInProgress || {}) };
          pIP[pageId] = responses;
          return {
            ...state,
            updateTimestamp: updateDT,
            paperworkInProgress: pIP,
          };
        });
      },
      patchCompletedPaperwork: (QR: QuestionnaireResponse) => {
        const updateDT = DateTime.now().toSeconds();
        set((state) => ({
          ...state,
          updateTimestamp: updateDT,
          paperworkResponse: {
            ...(state.paperworkResponse || ({} as UCGetPaperworkResponse)),
            questionnaireResponse: QR,
          },
          paperworkInProgress: {},
        }));
      },
      clear: () => {
        set({
          ...PAPERWORK_STATE_INITIAL,
        });
      },
    }),
    { name: 'ip-intake-paperwork-store-0.1' }
  )
);

export const PaperworkHome: FC = () => {
  const [appointmentNotFound, setAppointmentNotFound] = useState<boolean>(false);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth0();
  const { id: appointmentId } = useParams();
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const { pathname } = useLocation();
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

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
    const fetchAuthedPaperwork = async (apptId: string, zambdaClient: ZambdaClient): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const paperworkResponse = await zapehrApi.getPaperwork(zambdaClient, {
          appointmentID: apptId,
        });
        setResponse(paperworkResponse);
        setAuthedFetchState(AuthedLoadingState.complete);
      } catch (e) {
        if (isApiError(e)) {
          const apiError = e as APIError;
          if (apiError.code === NO_READ_ACCESS_TO_PATIENT_ERROR.code) {
            setAuthedFetchState(AuthedLoadingState.noReadAccess);
          } else {
            setAuthedFetchState(AuthedLoadingState.complete);
          }
        }
      }
    };
    if (isAuthenticated && tokenfulZambdaClient && authedFetchState === AuthedLoadingState.initial && appointmentId) {
      void fetchAuthedPaperwork(appointmentId, tokenfulZambdaClient);
    }
  }, [isAuthenticated, authedFetchState, setResponse, tokenfulZambdaClient, setAuthedFetchState, appointmentId]);

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
      // console.log('clearing state');
      clearPaperworkState();
    }
  }, [appointmentId, appointment?.id, clearPaperworkState]);

  const completedPaperwork: QuestionnaireResponseItem[] = useMemo(() => {
    return questionnaireResponse?.item ?? [];
  }, [questionnaireResponse?.item]);

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  // console.log('completed paperwork', completedPaperwork);
  // console.log('allItems', allItems);
  // console.log('questions', questions);

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

  const redirectTarget = useMemo(() => {
    if (pages && pages.length && authedFetchState === AuthedLoadingState.complete) {
      const firstPage = pages[0].linkId.replace('-page', '');
      if (pathname === `/paperwork/${appointmentId}`) {
        return `/paperwork/${appointmentId}/${firstPage}`;
      }
    }
    return undefined;
  }, [appointmentId, authedFetchState, pathname, pages]);

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (appointmentNotFound) {
    return (
      <PageContainer title={t('paperwork.errors.notFound')} description={appointmentNotFoundInformation}>
        <></>
      </PageContainer>
    );
  }

  if (
    (isAuthenticated || authIsLoading) &&
    (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading)
  ) {
    return (
      <PageContainer title={t('paperwork.loading')}>
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }
  if (redirectTarget) {
    // console.log('redirecting...', redirectTarget);
    return <Navigate to={redirectTarget} replace={true} />;
  }
  return <Outlet context={{ ...outletContext }} />;
};

export const PaperworkPage: FC = () => {
  // const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: appointmentID, slug } = useParams();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
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
    pages: paperworkPages,
    patient: paperworkPatient,
    questionnaireResponse,
  } = usePaperworkContext();

  const questionnaireResponseId = questionnaireResponse?.id;
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
      // throw new Error('paperworkQuestions is not defined');
      return empty;
    }
    // console.log('current slug', slug);
    const currentPage = paperworkPages.find((pageTemp) => slugFromLinkId(pageTemp.linkId) === slug);
    // console.log('current page', currentPage);
    if (!currentPage) {
      // throw new Error('currentPage is not defined'); // todo: some better way of erroring here
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

  // todo: use or delete
  const [loading, setLoading] = useState<boolean>(false);

  // Update last active time for paperwork-in-progress flag every minute
  useSetLastActiveTime(appointmentID, !!slug, tokenlessZambdaClient);

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
    // console.log('current page entries', currentPageEntries);
    const pageDefaults = (currentPageEntries ?? []).reduce((accum, entry) => {
      accum[entry.linkId] = { ...entry };
      return accum;
    }, {} as QuestionnaireFormFields);

    // console.log('in progress stuff', inProgress);
    // console.log('in progress page defaults', pageDefaults);
    return { ...currentPageFields, ...pageDefaults, ...inProgress };
  }, [completedPaperwork, currentPage, paperworkInProgress]);

  // console.log('completed', completedPaperwork);
  // console.log('paperworkGroupDefaults', paperworkGroupDefaults);

  const finishPaperworkPage = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      const patchPaperwork = async (
        data: QuestionnaireResponseItem[],
        questionnaireResponseId: string,
        pageId: string,
        zambdaClient: ZambdaClient
      ): Promise<QuestionnaireResponse> => {
        return api.patchPaperwork(zambdaClient, {
          answers: { linkId: pageId, item: data },
          questionnaireResponseId,
        });
      };

      if (data && appointmentID && tokenlessZambdaClient && currentPage && questionnaireResponseId) {
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
            if (item?.answer?.[0] == undefined) {
              return { ...item, answer: undefined };
            }
            return item;
          });
        // console.log('responseItems', responseItems, data);
        try {
          setLoading(true);
          const updatedPaperwork = await patchPaperwork(
            responseItems,
            questionnaireResponseId,
            currentPage.linkId,
            tokenlessZambdaClient
          );
          patchCompletedPaperwork(updatedPaperwork);
          saveProgress(currentPage.linkId, undefined);
          navigate(
            `/paperwork/${appointmentID}/${nextPage !== undefined ? slugFromLinkId(nextPage.linkId) : 'review'}`
          );
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
      tokenlessZambdaClient,
      currentPage,
      patchCompletedPaperwork,
      saveProgress,
      navigate,
      nextPage,
    ]
  );

  return (
    <PageContainer title={pageName ?? ''} patientFullName={patientFullName}>
      {empty ? (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box> // can we do something better than an infinite loader here?
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
    </PageContainer>
  );
};

export const slugFromLinkId = (linkId: string): string => {
  return linkId.replace('-page', '');
};

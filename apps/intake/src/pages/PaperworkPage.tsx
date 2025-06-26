// cSpell:ignore tokenful
import { Close } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { QuestionnaireResponse, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { t } from 'i18next';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  APIError,
  ComplexValidationResult,
  ComplexValidationResultFailureCase,
  convertQRItemToLinkIdMap,
  convertQuestionnaireItemToQRLinkIdMap,
  evalComplexValidationTrigger,
  evalEnableWhen,
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  getSelectors,
  InsuranceEligibilityCheckStatus,
  IntakeQuestionnaireItem,
  isApiError,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  QuestionnaireFormFields,
  UCGetPaperworkResponse,
  uuidRegex,
} from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ottehrApi } from '../api';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { PaperworkContext, usePaperworkContext } from '../features/paperwork';
import PagedQuestionnaire from '../features/paperwork/PagedQuestionnaire';
import useAppointmentNotFoundInformation from '../helpers/information';
import { useGetFullName } from '../hooks/useGetFullName';
import { useUCZambdaClient, ZambdaClient } from '../hooks/useUCZambdaClient';

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
        set((state) => {
          const pIP = { ...(state.paperworkInProgress || {}) };
          pIP[pageId] = responses;
          return {
            ...state,
            paperworkInProgress: pIP,
          };
        });
      },
      patchCompletedPaperwork: (QR: QuestionnaireResponse) => {
        set((state) => ({
          ...state,
          paperworkResponse: {
            ...(state.paperworkResponse || ({} as UCGetPaperworkResponse)),
            questionnaireResponse: QR,
          },
          paperworkInProgress: {},
        }));
      },
      clear: () => {
        set(PAPERWORK_STATE_INITIAL);
      },
    }),
    { name: 'ip-intake-paperwork-store-0.1' }
  )
);

export const PaperworkHome: FC = () => {
  const [appointmentNotFound, setAppointmentNotFound] = useState<boolean>(false);
  const { id: appointmentId } = useParams();
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const { pathname } = useLocation();
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const { paperworkInProgress, paperworkResponse, updateTimestamp, setResponse } = getSelectors(usePaperworkStore, [
    'paperworkInProgress',
    'setResponse',
    'paperworkResponse',
    'updateTimestamp',
  ]);

  const { allItems, questionnaireResponse, appointment, patient } = useMemo(() => {
    if (paperworkResponse === undefined) {
      return {
        allItems: [] as IntakeQuestionnaireItem[],
        questionnaireResponse: undefined,
        appointment: undefined,
        patient: undefined,
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
    const fetchAuthedPaperwork = async (apptId: string, zambdaClient: ZambdaClient): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const paperworkResponse = await ottehrApi.getPaperwork(zambdaClient, {
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
    if (tokenfulZambdaClient && authedFetchState === AuthedLoadingState.initial && appointmentId) {
      void fetchAuthedPaperwork(appointmentId, tokenfulZambdaClient);
    }
  }, [authedFetchState, setResponse, tokenfulZambdaClient, setAuthedFetchState, appointmentId]);

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

  if (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading) {
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
  const navigate = useNavigate();
  const { id: appointmentID, slug } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });
  const [validationRoadblockConfig, setValidationRoadblockConfig] = useState<ValidationRoadblockConfig | undefined>();
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
    allItems,
  } = usePaperworkContext();

  const questionnaireResponseId = questionnaireResponse?.id;
  // this is just for avoiding duplicates in the mixpanel tracking
  const [lastLoggedPageName, setLastLoggedPageName] = useState<string>();

  const patientFullName = useGetFullName(paperworkPatient);

  const { pageName, currentPage, currentIndex, empty, questionnaireItems } = useMemo(() => {
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
    const currentPage = paperworkPages.find((pageTemp) => slugFromLinkId(pageTemp.linkId) === slug);
    if (!currentPage) {
      // throw new Error('currentPage is not defined'); // todo: some better way of erroring here
      return empty;
    }

    const pageName = currentPage.text;
    const questionnaireItems = currentPage.item ?? [];
    const currentIndex = paperworkPages.findIndex((pageTemp) => pageTemp.linkId === currentPage.linkId);
    return { pageName, currentPage, currentIndex, empty: false, questionnaireItems };
  }, [paperworkPages, slug]);

  const getNextPage = useCallback(
    (qr: QuestionnaireResponse) => {
      if (currentIndex === undefined) {
        return undefined;
      }
      const paperworkValues = convertQRItemToLinkIdMap(qr.item);
      let idx = 1;
      let nextPage = paperworkPages[currentIndex + idx];
      while (nextPage && !evalEnableWhen(nextPage, allItems, paperworkValues)) {
        idx += 1;
        nextPage = paperworkPages[currentIndex + idx];
      }
      return nextPage;
    },
    [allItems, currentIndex, paperworkPages]
  );

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
    const currentPageFields = convertQuestionnaireItemToQRLinkIdMap(currentPage?.item);
    const currentPageEntries = completedPaperwork.find((item) => item.linkId === currentPage?.linkId)?.item;
    const inProgress = paperworkInProgress[currentPage?.linkId ?? ''] ?? {};
    if (!currentPageEntries && !inProgress) {
      return { ...currentPageFields };
    }

    const pageDefaults = convertQRItemToLinkIdMap(currentPageEntries);

    return { ...currentPageFields, ...pageDefaults, ...inProgress };
  }, [completedPaperwork, currentPage, paperworkInProgress]);

  const finishPaperworkPage = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      if (data && appointmentID && zambdaClient && currentPage && questionnaireResponseId && paperworkPatient) {
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
        const handlePatchPaperwork = async (
          item: QuestionnaireResponseItem[],
          zambdaClient: ZambdaClient
        ): Promise<void> => {
          try {
            setLoading(true);
            const updatedPaperwork = await api.patchPaperwork(zambdaClient, {
              answers: { linkId: currentPage.linkId, item },
              questionnaireResponseId,
            });
            patchCompletedPaperwork(updatedPaperwork);
            saveProgress(currentPage.linkId, undefined);
            const nextPage = getNextPage(updatedPaperwork);
            navigate(
              `/paperwork/${appointmentID}/${nextPage !== undefined ? slugFromLinkId(nextPage.linkId) : 'review'}`
            );
          } catch (e) {
            // todo: handle this better
            console.error('error patching paperwork', e);
          } finally {
            setLoading(false);
          }
        };
        try {
          if (currentPage.complexValidation !== undefined && evalComplexValidationTrigger(currentPage, responseItems)) {
            setValidationRoadblockConfig({
              type: 'in-progress',
              title: 'Hang tight',
              message: "We're verifying your insurance information. This shouldn't take long...",
            });
            const complexValidationResult = await performComplexValidation(
              {
                appointmentId: appointmentID,
                patientId: paperworkPatient.id ?? '',
                responseItems,
                type: currentPage.complexValidation.type,
              },
              zambdaClient
            );
            const { valueEntries } = complexValidationResult;
            Object.entries(valueEntries).forEach((e) => {
              const [key, val] = e;
              const existingIdx = responseItems.findIndex((i) => {
                return i.linkId === key;
              });
              if (existingIdx >= 0) {
                responseItems[existingIdx] = { linkId: key, answer: val };
              } else {
                responseItems.push({ linkId: key, answer: val });
              }
            });

            if (complexValidationResult.type === 'failure') {
              const { attemptCureAction, canProceed } = complexValidationResult;
              const edConfig: ValidationRoadblockConfig = {
                ...complexValidationResult,
              };
              if (canProceed) {
                edConfig.onContinueClick = async () => {
                  setValidationRoadblockConfig(undefined);
                  await handlePatchPaperwork(responseItems, zambdaClient);
                };
              }
              if (attemptCureAction) {
                edConfig.onRetryClick = () => {
                  setValidationRoadblockConfig(undefined);
                };
              }
              setValidationRoadblockConfig(edConfig);
              return;
            }
          }
          setValidationRoadblockConfig(undefined);
          return handlePatchPaperwork(responseItems, zambdaClient);
        } catch (e) {
          // todo: handle this better
          console.error('error patching paperwork', e);
          setValidationRoadblockConfig(undefined);
        }
      }
    },
    [
      appointmentID,
      zambdaClient,
      currentPage,
      questionnaireResponseId,
      paperworkPatient,
      patchCompletedPaperwork,
      saveProgress,
      getNextPage,
      navigate,
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
            isSaving={loading}
            saveProgress={(data) => {
              const pageId = currentPage?.linkId;
              if (pageId) {
                saveProgress(pageId, data);
              }
            }}
          />
          <ComplexValidationRoadblock
            open={validationRoadblockConfig !== undefined}
            title={validationRoadblockConfig?.title ?? ''}
            message={validationRoadblockConfig?.message ?? ''}
            onRetryClick={validationRoadblockConfig?.onRetryClick}
            onContinueClick={validationRoadblockConfig?.onContinueClick}
            type={validationRoadblockConfig?.type ?? 'failure'}
          />
        </>
      )}
    </PageContainer>
  );
};

export const slugFromLinkId = (linkId: string): string => {
  return linkId.replace('-page', '');
};

interface ComplexValidationInput {
  appointmentId: string;
  patientId: string;
  responseItems: QuestionnaireResponseItem[];
  type: string;
}

const performComplexValidation = async (
  input: ComplexValidationInput,
  client: ZambdaClient
): Promise<ComplexValidationResult> => {
  const { appointmentId, patientId, responseItems, type } = input;

  if (type === 'insurance eligibility') {
    const eligibilityRes = await api.getEligibility(
      {
        appointmentId,
        patientId,
        coveragePrevalidationInput: {
          responseItems,
        },
      },
      client
    );
    const { primary, secondary } = eligibilityRes;
    const valueEntryValues: QuestionnaireResponseItemAnswer[] = [{ valueString: primary!.status }];
    if (secondary?.status != undefined) {
      valueEntryValues.push({ valueString: secondary?.status });
    }
    if (
      primary?.status === InsuranceEligibilityCheckStatus.eligibilityConfirmed ||
      primary?.status === InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported
    ) {
      return {
        type: 'success',
        valueEntries: {
          'insurance-eligibility-verification-status': valueEntryValues,
        },
      };
    } else {
      let message = '';
      let title = '';
      let attemptCureAction: string | undefined;
      if (primary?.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked) {
        title = 'Coverage could not be verified';
        message =
          'System not responding; unable to verify eligibility. Proceed to the next screen to continue as self-pay.';
      }
      if (primary?.status === InsuranceEligibilityCheckStatus.eligibilityNotConfirmed) {
        title = 'Coverage not found';
        message =
          'We were unable to verify insurance eligibility. Please select "Try again" to confirm the information was entered correctly or continue as self-pay';
        attemptCureAction = 'Try again';
      }
      return {
        type: 'failure',
        title,
        canProceed: true,
        message,
        attemptCureAction,
        valueEntries: {
          'insurance-eligibility-verification-status': valueEntryValues,
        },
      };
    }
  }
  return {
    type: 'success',
    valueEntries: {},
  };
};

interface ValidationRoadblockConfig
  extends Omit<ComplexValidationResultFailureCase, 'valueEntries' | 'canProceed' | 'type'> {
  type: 'failure' | 'in-progress' | 'success';
  onRetryClick?: () => void;
  onContinueClick?: () => Promise<void>;
}

interface ValidationRoadblockProps extends ValidationRoadblockConfig {
  open: boolean;
}

const ComplexValidationRoadblock: FC<ValidationRoadblockProps> = ({
  open,
  message,
  attemptCureAction,
  title,
  onRetryClick,
  onContinueClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(`(max-width: 480px)`);

  const dialogActions: ReactNode = (() => {
    const buttons: any[] = [];
    if (onRetryClick) {
      buttons.push(
        <Button
          key="validation-roadblock-retry-button"
          data-testid="validation-roadblock-retry-button"
          variant={onContinueClick ? 'outlined' : 'contained'}
          onClick={onRetryClick}
          size={isMobile ? 'small' : 'large'}
          sx={{
            fontWeight: '700',
          }}
        >
          <span>{attemptCureAction ?? 'Try again'}</span>
        </Button>
      );
    }
    if (onContinueClick) {
      buttons.push(
        <Button
          key="validation-roadblock-continue-button'"
          data-testid="validation-roadblock-continue-button"
          variant="contained"
          onClick={onContinueClick}
          size={isMobile ? 'small' : 'large'}
          sx={{
            fontWeight: '700',
            marginTop: isMobile ? 1 : 0,
            marginLeft: isMobile ? '0 !important' : 1,
          }}
        >
          <span>{'Self pay'}</span>
        </Button>
      );
    }
    return (
      <DialogActions
        sx={{
          justifyContent: `${buttons.length > 1 ? 'space-between' : 'end'}`,
          display: isMobile ? 'contents' : 'flex',
          marginLeft: isMobile ? 0 : 'initial',
        }}
      >
        {buttons}
      </DialogActions>
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onRetryClick}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 2,
        },
      }}
    >
      <DialogTitle variant="h2" color="secondary.main" sx={{ width: '80%' }} data-testid="validation-roadblock-title">
        <span>{title}</span>
        {onRetryClick && (
          <IconButton
            aria-label={t('general.button.close')}
            onClick={onRetryClick}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          sx={{
            color: theme.palette.text.primary,
          }}
          data-testid="validation-roadblock-content-text"
        >
          {message}
        </DialogContentText>
      </DialogContent>
      {dialogActions}
    </Dialog>
  );
};

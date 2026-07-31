import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePaperworkComponentHelpers } from 'src/hooks/usePaperworkComponentHelpers';
import { PagedQuestionnaire, PaperworkContext, PaperworkProvider } from 'ui-components';
import {
  APIError,
  convertQRItemToLinkIdMap,
  convertQuestionnaireItemToQRLinkIdMap,
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  getSelectors,
  IntakeQuestionnaireItem,
  isApiError,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  QuestionnaireFormFields,
} from 'utils';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { useUCZambdaClient, ZambdaClient } from '../hooks/useUCZambdaClient';
import { usePaperworkStore } from './PaperworkPage';

enum AuthedLoadingState {
  initial,
  loading,
  complete,
  noReadAccess,
}

// Recursively collect every linkId on a page (groups can nest) so a page submit only writes the
// answers that belong to the current page — mirrors `extractPageLinkIds` in PaperworkPage.
export function extractPageLinkIds(items: IntakeQuestionnaireItem[] = []): string[] {
  return items.flatMap((item) => [item.linkId, ...(item.item ? extractPageLinkIds(item.item) : [])]);
}

export const StandaloneFormPage: FC = () => {
  const { questionnaireResponseId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const {
    paperworkInProgress,
    paperworkResponse,
    updateTimestamp,
    setResponse,
    patchCompletedPaperwork,
    saveProgress,
    setContinueLabel,
    continueLabel,
  } = getSelectors(usePaperworkStore, [
    'paperworkInProgress',
    'setResponse',
    'paperworkResponse',
    'updateTimestamp',
    'patchCompletedPaperwork',
    'saveProgress',
    'setContinueLabel',
    'continueLabel',
  ]);

  const { allItems, questionnaireResponse, appointment, patient, questionnaireTitle } = useMemo(() => {
    if (paperworkResponse === undefined) {
      return {
        allItems: [] as IntakeQuestionnaireItem[],
        questionnaireResponse: undefined,
        appointment: undefined,
        patient: undefined,
        questionnaireTitle: '',
      };
    } else {
      const { allItems, questionnaireResponse, appointment, patient, questionnaireTitle } = paperworkResponse;
      return {
        allItems: allItems ?? [],
        questionnaireResponse,
        appointment,
        patient,
        questionnaireTitle: questionnaireTitle ?? '',
      };
    }
  }, [paperworkResponse]);

  const appointmentId = appointment?.id ?? '';

  useEffect(() => {
    const fetchAuthedPaperwork = async (questionnaireResponseId: string, zambdaClient: ZambdaClient): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const paperworkResponse = await api.getStandAlonePaperwork(zambdaClient, { questionnaireResponseId });
        setResponse(paperworkResponse, appointmentId);
        setAuthedFetchState(AuthedLoadingState.complete);
      } catch (e) {
        if (isApiError(e)) {
          const apiError = e as APIError;
          if (apiError.code === NO_READ_ACCESS_TO_PATIENT_ERROR.code) {
            setAuthedFetchState(AuthedLoadingState.noReadAccess);
          } else {
            setLoadError(true);
            setAuthedFetchState(AuthedLoadingState.complete);
          }
        } else {
          setLoadError(true);
          setAuthedFetchState(AuthedLoadingState.complete);
        }
      }
    };
    if (zambdaClient && authedFetchState === AuthedLoadingState.initial && questionnaireResponseId) {
      void fetchAuthedPaperwork(questionnaireResponseId, zambdaClient);
    }
  }, [authedFetchState, setResponse, zambdaClient, setAuthedFetchState, questionnaireResponseId, appointmentId]);

  const completedPaperwork: QuestionnaireResponseItem[] = useMemo(() => {
    return questionnaireResponse?.item ?? [];
  }, [questionnaireResponse?.item]);

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  // One-off forms can't pull in credit card fields, so these fields are not needed at the moment

  // const {
  //   data: stripeSetupData,
  //   isFetching: isSetupDataLoading,
  //   refetch: refetchSetupData,
  // } = useSetupPaymentMethod(patient?.id, appointment?.id);

  // const {
  //   data: cardData,
  //   isFetching: cardsAreLoading,
  //   refetch: refetchPaymentMethods,
  // } = useGetPaymentMethods({
  //   beneficiaryPatientId: patient?.id,
  //   appointmentId: appointment?.id,
  //   setupCompleted: Boolean(stripeSetupData),
  // });

  const paperworkComponentHelpers = usePaperworkComponentHelpers();

  // Standalone managed forms render outside the paperwork `<Outlet>`, so we supply the context that
  // PagedQuestionnaire and its child hooks read. Only `paperwork`, `allItems`, `questionnaireResponse`,
  // `appointment.id`, and `saveButtonDisabled`/`setSaveButtonDisabled` are consumed on the vanilla +
  // attachment render path; payment/pharmacy/AI fields are inert here because those inputs never render
  // for managed questionnaires.
  const paperworkContextValue = useMemo<PaperworkContext>(
    () => ({
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
      cardsAreLoading: false, // not relevant at the moment
      paymentMethods: [], // not relevant at the moment
      paymentMethodStateInitializing: false, // not relevant at the moment
      stripeSetupData: undefined, // not relevant at the moment
      setContinueLabel,
      continueLabel,
      refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any, // not relevant at the moment
      refetchSetupData: (async () => ({})) as any, // not relevant at the moment
      setSaveButtonDisabled,
      findAnswerWithLinkId: (linkId: string): QuestionnaireResponseItem | undefined => {
        return findQuestionnaireResponseItemLinkId(linkId, completedPaperwork);
      },
      paperworkComponentHelpers,
    }),
    [
      appointment,
      completedPaperwork,
      paperworkInProgress,
      allItems,
      pages,
      questionnaireResponse,
      patient,
      updateTimestamp,
      saveButtonDisabled,
      setContinueLabel,
      continueLabel,
      paperworkComponentHelpers,
    ]
  );

  const { currentPage, isLastPage, submitted } = useMemo(() => {
    const currentPage = pages[currentPageIndex]; // this will be undefined when we finish the form
    const isLastPage = currentPageIndex === pages.length - 1;
    const submitted = currentPageIndex > pages.length - 1;

    return { currentPage, isLastPage, submitted };
  }, [pages, currentPageIndex]);

  useEffect(() => {
    if (isLastPage) {
      setContinueLabel('Submit');
    } else {
      setContinueLabel(undefined); // allows control buttons to fall back to the default
    }
  }, [isLastPage, setContinueLabel]);

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

  const errorPageMessage = useMemo(() => {
    if (authedFetchState === AuthedLoadingState.noReadAccess) {
      return 'Access Denied';
    } else if (loadError) {
      return 'Error loading this form.';
    }
    return;
  }, [loadError, authedFetchState]);

  const finishPage = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      if (!zambdaClient || !currentPage || !questionnaireResponseId) return;

      setSaving(true);
      setSaveError(false);

      try {
        // The form state holds values for every visited field; only this page's answers may be
        // written into this page's response item (mirrors PaperworkPage.finishPaperworkPage).
        const pageLinkIds = extractPageLinkIds(currentPage.item ?? []);
        const item = (Object.values(data) as QuestionnaireResponseItem[])
          .filter((qrItem) => {
            if (!pageLinkIds.includes(qrItem.linkId)) return false;
            if (qrItem.linkId === undefined || (qrItem.answer === undefined && qrItem.item === undefined)) return false;
            return true;
          })
          // Group/empty items can leave a stale `answer: [null]`; normalize it away.
          .map((qrItem) => (qrItem?.answer?.[0] == undefined ? { ...qrItem, answer: undefined } : qrItem));

        const updatedPaperwork = await api.patchPaperwork(zambdaClient, {
          answers: { linkId: currentPage.linkId, item },
          questionnaireResponseId,
          appointmentId: appointment?.id,
        });

        if (isLastPage) {
          await api.submitPaperwork(zambdaClient, {
            answers: updatedPaperwork.item ?? [],
            questionnaireResponseId,
            appointmentId: appointment?.id,
          });
        }

        patchCompletedPaperwork(updatedPaperwork);
        saveProgress(currentPage.linkId, undefined);
        setCurrentPageIndex((prev) => prev + 1);
      } catch (err) {
        // Stay on the page and tell the patient — a silent failure looks like a dead Submit button.
        console.error('Failed to save response:', err);
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    },
    [zambdaClient, questionnaireResponseId, appointment, currentPage, patchCompletedPaperwork, saveProgress, isLastPage]
  );

  const controlButtons = useMemo(
    () => ({
      backButton: currentPageIndex !== 0,
      onBack: () => setCurrentPageIndex((prev) => prev - 1),
      loading: saving,
    }),
    [currentPageIndex, saving]
  );

  if (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (errorPageMessage) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          {errorPageMessage}
        </Typography>
      </PageContainer>
    );
  }

  if (submitted) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F347C', mb: 1 }}>
            Form Submitted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Thank you for completing {questionnaireTitle}. You may close this page.
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(false)}>
          We couldn't save your answers. Please check your connection and try again.
        </Alert>
      )}
      <PaperworkProvider value={paperworkContextValue}>
        <PagedQuestionnaire
          onSubmit={finishPage}
          pageId={currentPage?.linkId ?? ''}
          pageItem={currentPage}
          pageSubtitle={questionnaireTitle}
          options={{ controlButtons }}
          items={currentPage.item ?? []}
          defaultValues={paperworkGroupDefaults}
          isSaving={saving}
          // Standalone forms persist per page; there is no in-progress store to flush on unload atm.
          saveProgress={() => {}}
          skipValidation={false}
        />
      </PaperworkProvider>
    </PageContainer>
  );
};

export default StandaloneFormPage;

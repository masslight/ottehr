import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { PaperworkContext, PaperworkProvider } from 'src/features/paperwork';
import PagedQuestionnaire from 'src/features/paperwork/PagedQuestionnaire';
import {
  APIError,
  AppointmentSummary,
  convertQRItemToLinkIdMap,
  convertQuestionnaireItemToQRLinkIdMap,
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
  isApiError,
  mapQuestionnaireAndValueSetsToItemsList,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  QuestionnaireFormFields,
} from 'utils';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

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
  const { appointmentId, questionnaireId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [questionnaireTitle, setQuestionnaireTitle] = useState<string | undefined>(undefined);
  const [questionnaireItems, setQuestionnaireItems] = useState<QuestionnaireItem[] | null>(null);
  const [questionnaireResponse, setQuestionnaireResponse] = useState<QuestionnaireResponse | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const methods = useForm();

  useEffect(() => {
    if (!zambdaClient || !appointmentId || authedFetchState !== AuthedLoadingState.initial || !questionnaireId) return;

    const fetchManagedPaperwork = async (): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const response = await api.getPracticeManagedPaperwork(zambdaClient, { appointmentId, questionnaireId });
        const { practiceManagedPaperwork } = response;
        setQuestionnaireTitle(practiceManagedPaperwork.questionnaireTitle);
        setQuestionnaireItems(practiceManagedPaperwork.questionnaireItems);

        if (practiceManagedPaperwork.questionnaireResponse) {
          setQuestionnaireResponse(practiceManagedPaperwork.questionnaireResponse);
        }
      } catch (e) {
        if (isApiError(e)) {
          const apiError = e as APIError;
          if (apiError.code === NO_READ_ACCESS_TO_PATIENT_ERROR.code) {
            setAuthedFetchState(AuthedLoadingState.noReadAccess);
          }
        }
      } finally {
        setAuthedFetchState(AuthedLoadingState.complete);
      }
    };

    void fetchManagedPaperwork();
  }, [zambdaClient, appointmentId, questionnaireId, authedFetchState, methods]);

  const pages = useMemo<IntakeQuestionnaireItem[]>(() => {
    const converted = mapQuestionnaireAndValueSetsToItemsList(questionnaireItems ?? [], []);
    const groups = converted.filter((item) => item.type === 'group');
    if (groups.length > 0) {
      return groups;
    }
    // Flat questionnaire (no top-level group): wrap everything in one synthetic page so the answers
    // round-trip under a stable page linkId.
    if (converted.length > 0) {
      return [
        {
          linkId: `${questionnaireId}-page`,
          type: 'group',
          text: questionnaireTitle,
          item: converted,
          acceptsMultipleAnswers: false,
          alwaysFilter: false,
        } as IntakeQuestionnaireItem,
      ];
    }
    return [];
  }, [questionnaireItems, questionnaireId, questionnaireTitle]);

  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const submitted = currentPageIndex > pages.length - 1;

  // Per-page form seed: empty shells for every field, overlaid with any saved answers for this page.
  const pageDefaults = useMemo<QuestionnaireFormFields>(() => {
    if (!currentPage) return {};
    const fieldShells = convertQuestionnaireItemToQRLinkIdMap(currentPage.item);
    const savedPageItems = (questionnaireResponse?.item ?? []).find((i) => i.linkId === currentPage.linkId)?.item;
    const saved = convertQRItemToLinkIdMap(savedPageItems);
    return { ...fieldShells, ...saved };
  }, [currentPage, questionnaireResponse]);

  // Standalone managed forms render outside the paperwork `<Outlet>`, so we supply the context that
  // PagedQuestionnaire and its child hooks read. Only `paperwork`, `allItems`, `questionnaireResponse`,
  // `appointment.id`, and `saveButtonDisabled`/`setSaveButtonDisabled` are consumed on the vanilla +
  // attachment render path; payment/pharmacy/AI fields are inert here because those inputs never render
  // for managed questionnaires.
  const paperworkContextValue = useMemo<PaperworkContext>(
    () => ({
      paperwork: questionnaireResponse?.item ?? [],
      allItems: flattenIntakeQuestionnaireItems(pages),
      questionnaireResponse,
      appointment: appointmentId ? ({ id: appointmentId } as AppointmentSummary) : undefined,
      saveButtonDisabled,
      setSaveButtonDisabled,
      // Inert on the managed render path:
      pageItems: pages,
      pages,
      paperworkInProgress: {},
      patient: undefined,
      updateTimestamp: undefined,
      cardsAreLoading: false,
      paymentMethodStateInitializing: false,
      paymentMethods: [],
      stripeSetupData: undefined,
      setContinueLabel: () => {},
      refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any,
      refetchSetupData: (async () => ({})) as any,
      findAnswerWithLinkId: (linkId: string) =>
        findQuestionnaireResponseItemLinkId(linkId, questionnaireResponse?.item ?? []),
    }),
    [pages, questionnaireResponse, appointmentId, saveButtonDisabled]
  );

  const finishPage = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      if (!zambdaClient || !questionnaireId || !appointmentId || !currentPage) return;

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

        const pageAnswers: QuestionnaireResponseItem = { linkId: currentPage.linkId, item };

        const { questionnaireResponse: updatedQR } = await api.savePracticeManagedPaperworkResponse(zambdaClient, {
          pageAnswers,
          questionnaireId,
          complete: isLastPage,
          appointmentId,
        });
        // Keep resume/defaults in sync so Back doesn't blank previously-entered answers.
        setQuestionnaireResponse(updatedQR);
        setCurrentPageIndex((prev) => prev + 1);
      } catch (err) {
        // Stay on the page and tell the patient — a silent failure looks like a dead Submit button.
        console.error('Failed to save response:', err);
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    },
    [zambdaClient, questionnaireId, appointmentId, currentPage, isLastPage]
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

  // todo sarah i think this should just redirect the user to the home page
  // or maybe prompt them to log in again? i dunno
  if (authedFetchState === AuthedLoadingState.noReadAccess) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Access Denied
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!questionnaireItems) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          Form not found.
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
          options={{
            controlButtons: {
              // Back must be explicit — ControlButtons defaults `backButton` to true and would
              // otherwise render a history-Back on page 1 that leaves the form.
              backButton: currentPageIndex !== 0,
              onBack: () => setCurrentPageIndex((prev) => prev - 1),
              loading: saving,
              submitLabel: isLastPage ? 'Submit' : 'Continue',
            },
          }}
          items={currentPage.item ?? []}
          defaultValues={pageDefaults}
          isSaving={saving}
          // Standalone forms persist per page; there is no in-progress store to flush on unload atm.
          saveProgress={() => {}}
        />
      </PaperworkProvider>
    </PageContainer>
  );
};

export default StandaloneFormPage;

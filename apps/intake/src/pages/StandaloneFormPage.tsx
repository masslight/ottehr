import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
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
import { create } from 'zustand';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { PaperworkContext, PaperworkProvider, usePaperworkContext } from '../features/paperwork';
import PagedQuestionnaire from '../features/paperwork/PagedQuestionnaire';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

enum AuthedLoadingState {
  initial,
  loading,
  complete,
  noReadAccess,
}

// Standalone managed form state. Mirrors the intake `usePaperworkStore` pattern: the layout
// (StandaloneFormHome) owns the fetched questionnaire + response here and builds the paperwork
// context from it; the page child writes the updated response back after each save. This is the
// bridge that lets the provider (layout) and consumer (page) live on opposite sides of the
// router outlet without modifying the shared `usePaperworkContext`.
type StandaloneFormState = {
  questionnaireId: string | undefined;
  questionnaireTitle: string | undefined;
  questionnaireItems: QuestionnaireItem[] | null;
  questionnaireResponse: QuestionnaireResponse | undefined;
};

interface StandaloneFormActions {
  setManagedPaperwork: (payload: {
    questionnaireId: string;
    questionnaireTitle: string;
    questionnaireItems: QuestionnaireItem[];
    questionnaireResponse: QuestionnaireResponse | undefined;
  }) => void;
  patchResponse: (questionnaireResponse: QuestionnaireResponse) => void;
  clear: () => void;
}

const STANDALONE_FORM_STATE_INITIAL: StandaloneFormState = {
  questionnaireId: undefined,
  questionnaireTitle: undefined,
  questionnaireItems: null,
  questionnaireResponse: undefined,
};

export const useStandaloneFormStore = create<StandaloneFormState & StandaloneFormActions>()((set) => ({
  ...STANDALONE_FORM_STATE_INITIAL,
  setManagedPaperwork: (payload) => set((state) => ({ ...state, ...payload })),
  patchResponse: (questionnaireResponse) => set((state) => ({ ...state, questionnaireResponse })),
  clear: () => set(STANDALONE_FORM_STATE_INITIAL),
}));

// Recursively collect every linkId on a page (groups can nest) so a page submit only writes the
// answers that belong to the current page — mirrors `extractPageLinkIds` in PaperworkPage.
function extractPageLinkIds(items: IntakeQuestionnaireItem[] = []): string[] {
  return items.flatMap((item) => [item.linkId, ...(item.item ? extractPageLinkIds(item.item) : [])]);
}

// Top-level groups are pages (the managed builder convention, identical to intake paperwork).
function derivePages(
  questionnaireItems: QuestionnaireItem[] | null,
  questionnaireId: string | undefined,
  questionnaireTitle: string | undefined
): IntakeQuestionnaireItem[] {
  // Managed questionnaires are stored as FHIR; convert to the intake item shape PagedQuestionnaire
  // consumes. `dataType`/`inputWidth` round-trip through extensions, so no special handling is needed.
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
}

/**
 * Layout for the standalone managed form. Fetches the managed questionnaire + response, then supplies
 * a scoped PaperworkContext through the router outlet — exactly how `PaperworkHome` provides context to
 * `PaperworkPage`. Living outside `PaperworkHome` keeps the main intake QR/validation state from leaking
 * in (see the route comment in App.tsx).
 */
export const StandaloneFormHome: FC = () => {
  const { appointmentId, questionnaireId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);
  // Backs the attachment-upload guard; FileInput toggles this while an Image/PDF uploads to Z3.
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const questionnaireItems = useStandaloneFormStore((state) => state.questionnaireItems);
  const questionnaireTitle = useStandaloneFormStore((state) => state.questionnaireTitle);
  const questionnaireResponse = useStandaloneFormStore((state) => state.questionnaireResponse);
  const setManagedPaperwork = useStandaloneFormStore((state) => state.setManagedPaperwork);
  const clear = useStandaloneFormStore((state) => state.clear);

  useEffect(() => {
    if (!zambdaClient || !appointmentId || authedFetchState !== AuthedLoadingState.initial || !questionnaireId) return;

    const fetchManagedPaperwork = async (): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const response = await api.getManagedPaperwork(zambdaClient, { appointmentId, questionnaireId });
        setManagedPaperwork({
          questionnaireId,
          questionnaireTitle: response.managedPaperwork.questionnaireTitle,
          questionnaireItems: response.managedPaperwork.questionnaireItems,
          // Seed any in-progress response so per-page defaultValues can resume instead of blanking.
          questionnaireResponse: response.managedPaperwork.questionnaireResponse,
        });
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
  }, [zambdaClient, appointmentId, questionnaireId, authedFetchState, setManagedPaperwork]);

  // Drop the form state on unmount so navigating to a different form doesn't resume stale answers.
  useEffect(() => {
    return () => clear();
  }, [clear]);

  const pages = useMemo(
    () => derivePages(questionnaireItems, questionnaireId, questionnaireTitle),
    [questionnaireItems, questionnaireId, questionnaireTitle]
  );

  // The scoped context PagedQuestionnaire + its child hooks read. Only `paperwork`, `allItems`,
  // `questionnaireResponse`, `appointment.id`, and `saveButtonDisabled`/`setSaveButtonDisabled` are
  // consumed on the vanilla + attachment render path; payment/pharmacy/AI fields are inert here.
  const outletContext = useMemo<PaperworkContext>(
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

  if (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

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

  if (!questionnaireItems || pages.length === 0) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          Form not found.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PaperworkProvider value={outletContext}>
      <Outlet />
    </PaperworkProvider>
  );
};

/**
 * Renders one page of the managed form at a time through intake's `PagedQuestionnaire`. Reads the
 * scoped context provided by `StandaloneFormHome`, keeps page-navigation state local, and writes the
 * saved response back to the store after each page so resume-on-Back and cross-page conditions stay
 * correct.
 */
export const StandaloneFormPage: FC = () => {
  const { appointmentId, questionnaireId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const { pages, questionnaireResponse } = usePaperworkContext();
  const questionnaireTitle = useStandaloneFormStore((state) => state.questionnaireTitle);
  const patchResponse = useStandaloneFormStore((state) => state.patchResponse);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const submitted = pages.length > 0 && currentPageIndex > pages.length - 1;

  // Per-page form seed: empty shells for every field, overlaid with any saved answers for this page.
  const pageDefaults = useMemo<QuestionnaireFormFields>(() => {
    if (!currentPage) return {};
    const fieldShells = convertQuestionnaireItemToQRLinkIdMap(currentPage.item);
    const savedPageItems = (questionnaireResponse?.item ?? []).find((i) => i.linkId === currentPage.linkId)?.item;
    return { ...fieldShells, ...convertQRItemToLinkIdMap(savedPageItems) };
  }, [currentPage, questionnaireResponse]);

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

        const updatedQR = await api.saveManagedPaperworkResponse(zambdaClient, {
          pageAnswers,
          questionnaireId,
          complete: isLastPage,
          appointmentId,
        });
        // Push the updated response back to the layout-provided context so Back resumes prior answers
        // and any cross-page enableWhen/validation sees the latest saved state.
        patchResponse(updatedQR);
        setCurrentPageIndex((prev) => prev + 1);
      } catch (err) {
        // Stay on the page and tell the patient — a silent failure looks like a dead Submit button.
        console.error('Failed to save response:', err);
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    },
    [zambdaClient, questionnaireId, appointmentId, currentPage, isLastPage, patchResponse]
  );

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

  if (!currentPage) {
    return null;
  }

  return (
    <PageContainer>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(false)}>
          We couldn't save your answers. Please check your connection and try again.
        </Alert>
      )}
      <Typography variant="h4" color="primary.main" sx={{ fontWeight: 600, mb: 3 }}>
        {currentPage.text || questionnaireTitle}
      </Typography>
      <PagedQuestionnaire
        items={currentPage.item ?? []}
        pageId={currentPage.linkId}
        pageItem={currentPage}
        defaultValues={pageDefaults}
        isSaving={saving}
        onSubmit={finishPage}
        // Standalone forms persist per page; there is no in-progress store to flush on unload.
        saveProgress={() => {}}
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
      />
    </PageContainer>
  );
};

import { Close } from '@mui/icons-material';
import { Alert, Box, Dialog, DialogContent, DialogTitle, IconButton, Typography, useTheme } from '@mui/material';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { updateVisitForm } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { PaperworkContext, PaperworkProvider } from 'ui-components/lib/components/paperwork/context';
import PagedQuestionnaire from 'ui-components/lib/components/paperwork/PagedQuestionnaire';
import { QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { convertQRItemToLinkIdMap, convertQuestionnaireItemToQRLinkIdMap } from 'utils/lib/helpers/paperwork/paperwork';
import { qrSentManually } from 'utils/lib/helpers/practice-managed-questionnaires';
import {
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  QuestionnaireFormFields,
} from 'utils/lib/types/data/paperwork/paperwork.types';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

const INERT_COMPONENT_HELPERS: PaperworkContext['paperworkComponentHelpers'] = {
  handleSearchPlaces: undefined,
  createZ3Object: undefined,
  getInsuranceCardSuggestions: undefined,
  getPhotoIdSuggestions: undefined,
  aIInterviewStart: undefined,
  aIInterviewHandleAnswer: undefined,
  setDefaultPaymentMethod: undefined,
  getAnswerOptions: undefined,
};

export const collectPageAnswers = (
  data: QuestionnaireFormFields,
  pageLinkIds: Set<string>
): QuestionnaireResponseItem[] =>
  (Object.values(data) as QuestionnaireResponseItem[])
    .filter((qrItem) => qrItem?.linkId !== undefined && pageLinkIds.has(qrItem.linkId))
    .filter((qrItem) => qrItem.answer !== undefined || qrItem.item !== undefined)
    .map((qrItem) => (qrItem?.answer?.[0] == undefined ? { ...qrItem, answer: undefined } : qrItem));

interface EditFormResponseDialogProps {
  open: boolean;
  form: StandaloneFormDTO | undefined;
  patientId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export const EditFormResponseDialog: FC<EditFormResponseDialogProps> = ({
  open,
  form,
  patientId,
  onClose,
  onSaved,
}) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editedPages, setEditedPages] = useState<Record<string, QuestionnaireResponseItem[]>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [continueLabel, setContinueLabel] = useState<string | undefined>('Save');
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const questionnaireResponseId = form?.questionnaireResponse.id;

  useEffect(() => {
    if (!open) return;
    setCurrentPageIndex(0);
    setEditedPages({});
    setSaving(false);
    setSaveError(undefined);
    setSaveButtonDisabled(false);
  }, [open, questionnaireResponseId, form?.questionnaireId]);

  const pages = useMemo(() => (form?.allItems ?? []).filter((item) => item.linkId), [form]);

  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;

  useEffect(() => {
    setContinueLabel(isLastPage ? 'Save' : 'Continue');
  }, [isLastPage]);

  // The tag on this in-memory copy is what makes PagedQuestionnaire honor `continueLabel`; without it
  // the submit button falls back to a translation key the EHR has no i18n bundle for.
  const liveQuestionnaireResponse = useMemo<QuestionnaireResponse | undefined>(() => {
    if (!form) return undefined;
    const persisted = form.questionnaireResponse;
    const tag = qrSentManually(persisted) ? persisted.meta?.tag : [...(persisted.meta?.tag ?? []), QR_DISTRIBUTION_TAG];

    return {
      ...persisted,
      meta: { ...persisted.meta, tag },
      item: (persisted.item ?? []).map((page) =>
        editedPages[page.linkId] ? { ...page, item: editedPages[page.linkId] } : page
      ),
    };
  }, [form, editedPages]);

  const paperworkContextValue = useMemo<PaperworkContext>(
    () => ({
      appointment: undefined,
      patient: undefined,
      paperwork: liveQuestionnaireResponse?.item ?? [],
      paperworkInProgress: {},
      pageItems: form?.allItems ?? [],
      allItems: flattenIntakeQuestionnaireItems(form?.allItems ?? []),
      pages,
      questionnaireResponse: liveQuestionnaireResponse,
      updateTimestamp: undefined,
      saveButtonDisabled,
      cardsAreLoading: false,
      paymentMethods: [],
      paymentMethodStateInitializing: false,
      stripeSetupData: undefined,
      setContinueLabel,
      continueLabel,
      refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any,
      refetchSetupData: (async () => ({})) as any,
      setSaveButtonDisabled,
      findAnswerWithLinkId: (linkId: string): QuestionnaireResponseItem | undefined =>
        findQuestionnaireResponseItemLinkId(linkId, liveQuestionnaireResponse?.item ?? []),
      paperworkComponentHelpers: INERT_COMPONENT_HELPERS,
    }),
    [form, pages, liveQuestionnaireResponse, saveButtonDisabled, continueLabel]
  );

  const paperworkGroupDefaults = useMemo(() => {
    const currentPageFields = convertQuestionnaireItemToQRLinkIdMap(currentPage?.item);
    const currentPageEntries = liveQuestionnaireResponse?.item?.find((item) => item.linkId === currentPage?.linkId)
      ?.item;

    if (!currentPageEntries) {
      return { ...currentPageFields };
    }

    return { ...currentPageFields, ...convertQRItemToLinkIdMap(currentPageEntries) };
  }, [currentPage, liveQuestionnaireResponse]);

  const save = useCallback(
    async (pagesToSave: Record<string, QuestionnaireResponseItem[]>): Promise<void> => {
      if (!oystehrZambda || !questionnaireResponseId || !patientId) return;

      setSaving(true);
      setSaveError(undefined);

      try {
        await updateVisitForm(oystehrZambda, {
          questionnaireResponseId,
          patientId,
          pages: Object.entries(pagesToSave).map(([linkId, item]) => ({ linkId, item })),
        });
      } catch (error) {
        console.error('Failed to save form response:', error);
        setSaveError("We couldn't save these answers. Please try again.");
        return;
      } finally {
        setSaving(false);
      }

      enqueueSnackbar('Form updated', { variant: 'success' });
      onSaved();
    },
    [oystehrZambda, questionnaireResponseId, patientId, onSaved]
  );

  const handlePageSubmit = useCallback(
    (data: QuestionnaireFormFields): void => {
      if (!currentPage) return;

      const pageLinkIds = new Set(flattenIntakeQuestionnaireItems(currentPage.item ?? []).map((item) => item.linkId));
      const nextEditedPages = { ...editedPages, [currentPage.linkId]: collectPageAnswers(data, pageLinkIds) };

      if (!isLastPage) {
        setEditedPages(nextEditedPages);
        setCurrentPageIndex((previous) => previous + 1);
        return;
      }

      setEditedPages(nextEditedPages);
      void save(nextEditedPages);
    },
    [currentPage, editedPages, isLastPage, save]
  );

  const controlButtons = useMemo(
    () => ({
      backButton: currentPageIndex !== 0,
      backButtonLabel: 'Back',
      onBack: () => setCurrentPageIndex((previous) => previous - 1),
      loading: saving,
    }),
    [currentPageIndex, saving]
  );

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      disableScrollLock
      maxWidth="sm"
      fullWidth
      sx={{ '.MuiPaper-root': { padding: 2 } }}
      data-testid={dataTestIds.visitDetailsPage.editFormResponseDialog}
    >
      <DialogTitle
        variant="h5"
        sx={{ fontSize: '20px', color: theme.palette.primary.dark, fontWeight: '600 !important' }}
      >
        {form?.questionnaireTitle ?? 'Edit form'}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          disabled={saving}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(undefined)}>
            {saveError}
          </Alert>
        )}
        {!form || !currentPage ? (
          <Typography variant="body2" color="text.secondary">
            This form has no questions to edit.
          </Typography>
        ) : (
          <Box>
            {pages.length > 1 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Page {currentPageIndex + 1} of {pages.length}
              </Typography>
            )}
            <PaperworkProvider value={paperworkContextValue}>
              <PagedQuestionnaire
                onSubmit={handlePageSubmit}
                pageId={currentPage.linkId}
                pageItem={currentPage}
                options={{ controlButtons }}
                items={currentPage.item ?? []}
                defaultValues={paperworkGroupDefaults}
                isSaving={saving}
                saveProgress={() => {}}
                skipValidation={false}
              />
            </PaperworkProvider>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

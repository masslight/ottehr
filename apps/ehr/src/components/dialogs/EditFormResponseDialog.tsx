import { Close } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, UseFormReturn, useFormState } from 'react-hook-form';
import { updateVisitForm } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { PaperworkContext, PaperworkProvider } from 'ui-components/lib/components/paperwork/context';
import PagedQuestionnaire from 'ui-components/lib/components/paperwork/PagedQuestionnaire';
import { convertQRItemToLinkIdMap, convertQuestionnaireItemToQRLinkIdMap } from 'utils/lib/helpers/paperwork/paperwork';
import {
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  QuestionnaireFormFields,
} from 'utils/lib/types/data/paperwork/paperwork.types';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

const BUTTON_SX = { fontWeight: 500, textTransform: 'none', borderRadius: 6 };

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

type QuestionnaireForm = UseFormReturn<QuestionnaireFormFields>;

interface FormStateBridgeProps {
  formRef: MutableRefObject<QuestionnaireForm | null>;
  onDirtyChange: (isDirty: boolean) => void;
}

// PagedQuestionnaire owns the react-hook-form instance, so this rides inside it to hand the form
// back out to the dialog — Save lives in the dialog actions, outside the form's tree.
const FormStateBridge: FC<FormStateBridgeProps> = ({ formRef, onDirtyChange }) => {
  const methods = useFormContext<QuestionnaireFormFields>();
  const { isDirty } = useFormState<QuestionnaireFormFields>();

  useEffect(() => {
    formRef.current = methods;
    return () => {
      formRef.current = null;
    };
  }, [formRef, methods]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  return null;
};

interface EditFormResponseDialogProps {
  form: StandaloneFormDTO;
  patientId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export const EditFormResponseDialog: FC<EditFormResponseDialogProps> = ({ form, patientId, onClose, onSaved }) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { allItems, questionnaireId, questionnaireResponse, questionnaireTitle } = form;

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const formRef = useRef<QuestionnaireForm | null>(null);

  const pages = useMemo(() => (allItems ?? []).filter((item) => item.linkId), [allItems]);

  // The dialog shows the whole questionnaire at once rather than the patient app's page-at-a-time
  // wizard, so the page groups are flattened away and every question shares one form. Flattening
  // (rather than handing the page groups over as items) is what keeps each field addressed by its
  // plain linkId, which is how the answers are stored and sent back.
  const items = useMemo(() => pages.flatMap((page) => page.item ?? []), [pages]);

  const defaultValues = useMemo(() => {
    const values: QuestionnaireFormFields = {};
    pages.forEach((page) => {
      Object.assign(values, convertQuestionnaireItemToQRLinkIdMap(page.item));
      const answers = questionnaireResponse.item?.find((item) => item.linkId === page.linkId)?.item;
      if (answers) {
        Object.assign(values, convertQRItemToLinkIdMap(answers));
      }
    });
    return values;
  }, [pages, questionnaireResponse.item]);

  const paperworkContextValue = useMemo<PaperworkContext>(
    () => ({
      appointment: undefined,
      patient: undefined,
      paperwork: questionnaireResponse.item ?? [],
      paperworkInProgress: {},
      pageItems: allItems ?? [],
      allItems: flattenIntakeQuestionnaireItems(allItems ?? []),
      pages,
      questionnaireResponse,
      updateTimestamp: undefined,
      cardsAreLoading: false,
      paymentMethods: [],
      paymentMethodStateInitializing: false,
      stripeSetupData: undefined,
      refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any,
      refetchSetupData: (async () => ({})) as any,
      setSaveButtonDisabled: () => {},
      findAnswerWithLinkId: (linkId: string): QuestionnaireResponseItem | undefined =>
        findQuestionnaireResponseItemLinkId(linkId, questionnaireResponse.item ?? []),
      paperworkComponentHelpers: INERT_COMPONENT_HELPERS,
    }),
    [allItems, pages, questionnaireResponse]
  );

  const handleValidSubmit = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      const questionnaireResponseId = questionnaireResponse.id;
      if (!oystehrZambda || !questionnaireResponseId || !patientId) return;
      if (!formRef.current?.formState.isDirty) return;

      setSaving(true);
      setSaveError(undefined);

      try {
        await updateVisitForm(oystehrZambda, {
          questionnaireResponseId,
          questionnaireId,
          patientId,
          pages: pages.map((page) => ({
            linkId: page.linkId,
            item: collectPageAnswers(
              data,
              new Set(flattenIntakeQuestionnaireItems(page.item ?? []).map((item) => item.linkId))
            ),
          })),
        });
      } catch (error) {
        console.error('Failed to save form response:', error);
        setSaveError("We couldn't save these answers. Please try again.");
        return;
      } finally {
        setSaving(false);
      }

      formRef.current?.reset(data);
      enqueueSnackbar('Form updated', { variant: 'success' });
      onSaved();
    },
    [oystehrZambda, patientId, pages, questionnaireId, questionnaireResponse.id, onSaved]
  );

  const submitFromActions = useCallback((): void => {
    void formRef.current?.handleSubmit(handleValidSubmit)();
  }, [handleValidSubmit]);

  const handleFormSubmit = useCallback(
    (data: QuestionnaireFormFields): void => {
      void handleValidSubmit(data);
    },
    [handleValidSubmit]
  );

  const questionnaireOptions = useMemo(
    () => ({
      hideControls: true,
      bottomComponent: <FormStateBridge formRef={formRef} onDirtyChange={setIsDirty} />,
    }),
    []
  );

  return (
    <Dialog
      open={true}
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
        {questionnaireTitle}
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
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            This form has no questions to edit.
          </Typography>
        ) : (
          <PaperworkProvider value={paperworkContextValue}>
            <PagedQuestionnaire
              pageId={questionnaireId}
              items={items}
              defaultValues={defaultValues}
              options={questionnaireOptions}
              isSaving={saving}
              onSubmit={handleFormSubmit}
              saveProgress={() => {}}
              skipValidation={false}
            />
          </PaperworkProvider>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" size="medium" onClick={onClose} disabled={saving} sx={BUTTON_SX}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          size="medium"
          onClick={submitFromActions}
          loading={saving}
          disabled={!isDirty}
          sx={BUTTON_SX}
          data-testid={dataTestIds.visitDetailsPage.editFormResponseSaveButton}
        >
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

import { Save } from '@mui/icons-material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, MutableRefObject, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, UseFormReturn, useFormState } from 'react-hook-form';
import { updateVisitForm } from 'src/api/api';
import { Section } from 'src/components/layout/Section';
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

const DESTRUCTIVE_MENU_ITEM_SX = { color: 'error.main', fontWeight: 500 };
const MENU_ITEM_ICON_SX = { color: 'inherit' };

const SHARED_RESPONSE_TOOLTIP =
  "This form was part of the visit's intake paperwork, so its answers share one response with the rest of that paperwork and cannot be deleted on their own.";

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
// back out to the card — the Save button lives in the card header, outside the form's tree.
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

interface CustomFormCardProps {
  form: StandaloneFormDTO;
  patientId: string | undefined;
  deletable: boolean;
  onDelete: () => void;
  onSaved: () => void;
}

export const CustomFormCard: FC<CustomFormCardProps> = ({ form, patientId, deletable, onDelete, onSaved }) => {
  const { oystehrZambda } = useApiClients();
  const { allItems, questionnaireId, questionnaireResponse, questionnaireTitle } = form;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const formRef = useRef<QuestionnaireForm | null>(null);

  const menuOpen = Boolean(anchorEl);
  const closeMenu = (): void => setAnchorEl(null);

  const pages = useMemo(() => (allItems ?? []).filter((item) => item.linkId), [allItems]);

  // The card shows the whole questionnaire at once rather than the patient app's page-at-a-time
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
    [oystehrZambda, patientId, pages, questionnaireResponse.id, onSaved]
  );

  const submitFromHeader = useCallback((): void => {
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

  const titleWidget = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isDirty && (
        <Button
          variant="outlined"
          size="small"
          startIcon={saving ? <CircularProgress size={14} /> : <Save fontSize="small" />}
          disabled={saving}
          onClick={submitFromHeader}
          data-testid={dataTestIds.visitDetailsPage.customFormSaveButton(questionnaireId)}
          sx={{ textTransform: 'none', fontSize: '13px', py: 0.25, px: 1.5 }}
        >
          Save
        </Button>
      )}
      <IconButton
        size="small"
        aria-label={`Actions for ${questionnaireTitle}`}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        data-testid={dataTestIds.visitDetailsPage.customFormMenuButton(questionnaireId)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {deletable ? (
          <MenuItem
            data-testid={dataTestIds.visitDetailsPage.customFormDeleteMenuItem}
            onClick={() => {
              closeMenu();
              onDelete();
            }}
            sx={DESTRUCTIVE_MENU_ITEM_SX}
          >
            <ListItemIcon sx={MENU_ITEM_ICON_SX}>
              <DeleteOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Delete
          </MenuItem>
        ) : (
          <Tooltip title={SHARED_RESPONSE_TOOLTIP} placement="left">
            <Box component="span">
              <MenuItem disabled sx={DESTRUCTIVE_MENU_ITEM_SX}>
                <ListItemIcon sx={MENU_ITEM_ICON_SX}>
                  <DeleteOutlinedIcon fontSize="small" />
                </ListItemIcon>
                Delete
              </MenuItem>
            </Box>
          </Tooltip>
        )}
      </Menu>
    </Box>
  );

  const body = ((): ReactElement => {
    if (items.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          This form has no questions.
        </Typography>
      );
    }
    return (
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
    );
  })();

  return (
    <Section
      title={questionnaireTitle}
      titleWidget={titleWidget}
      dataTestId={dataTestIds.visitDetailsPage.customFormCard(questionnaireId)}
    >
      {saveError && (
        <Alert severity="error" onClose={() => setSaveError(undefined)}>
          {saveError}
        </Alert>
      )}
      {body}
    </Section>
  );
};

import { Box, Typography } from '@mui/material';
import { PaperworkContext, PaperworkInjections } from 'ui-components';
import { findQuestionnaireResponseItemLinkId, IntakeQuestionnaireItem } from 'utils';

/**
 * Injections for the EHR builder previews. No specialized inputs are wired (credit card, AI
 * interview, pharmacy, dynamic options all stay in intake), so the only injected renderer is a
 * non-interactive stub for attachment fields — managed questionnaires can contain Image/PDF items
 * and a blank render would look broken.
 */
export const PREVIEW_INJECTIONS: PaperworkInjections = {
  renderAttachment: ({ description }) => (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: '#BFC2C6',
        borderRadius: '8px',
        p: 2,
        textAlign: 'center',
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2">{description || 'File upload'}</Typography>
      <Typography variant="caption">(File upload is shown in the patient app)</Typography>
    </Box>
  ),
};

/**
 * Split converted intake items into pages. Top-level groups are pages (the Ottehr convention,
 * identical to intake paperwork + StandaloneFormPage). A flat questionnaire (no top-level group)
 * is wrapped in one synthetic page so PagedQuestionnaire has a stable page linkId to render.
 */
export function buildPreviewPages(converted: IntakeQuestionnaireItem[], title?: string): IntakeQuestionnaireItem[] {
  const groups = converted.filter((item) => item.type === 'group');
  if (groups.length > 0) {
    return groups;
  }
  if (converted.length > 0) {
    return [
      {
        linkId: '_all-preview-page',
        type: 'group',
        text: title,
        item: converted,
        acceptsMultipleAnswers: false,
        alwaysFilter: false,
      } as IntakeQuestionnaireItem,
    ];
  }
  return [];
}

/**
 * A minimal PaperworkContext for the EHR builder previews. Only the vanilla render path's fields
 * are meaningful here (`paperwork`, `allItems`, `pages`, `pageItems`, `saveButtonDisabled`); the
 * specialized-input fields are inert because the EHR previews inject no specialized renderers.
 */
export function makeStubPaperworkContext(
  pages: IntakeQuestionnaireItem[],
  allItems: IntakeQuestionnaireItem[]
): PaperworkContext {
  return {
    paperwork: [],
    paperworkInProgress: {},
    pageItems: pages,
    pages,
    allItems,
    questionnaireResponse: undefined,
    appointment: undefined,
    patient: undefined,
    updateTimestamp: undefined,
    saveButtonDisabled: false,
    setSaveButtonDisabled: () => {},
    cardsAreLoading: false,
    paymentMethodStateInitializing: false,
    paymentMethods: [],
    stripeSetupData: undefined,
    setContinueLabel: () => {},
    refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any,
    refetchSetupData: (async () => ({})) as any,
    findAnswerWithLinkId: (linkId: string) => findQuestionnaireResponseItemLinkId(linkId, []),
  };
}

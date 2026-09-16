import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Checkbox, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { FC, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { TemplatePreviewApplyOptions, TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';
import { TemplatePreviewDialog } from '../templates/TemplatePreviewDialog';
import { TemplateOption } from '../templates/useListTemplates';
import { hasProvenance, ProvenanceContent } from './Provenance';
import { HOVER_ONLY, RecommendationEditor, ROW_CLASS } from './RecommendationRow';
import {
  RecommendationItemState,
  startEditingUnlessAnotherIsOpen,
  useScribeRecommendationsStore,
} from './scribeRecommendations.store';
import { describeRecommendation } from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { roundedButtonSx, scaled } from './scribeTheme';
import { SectionRail } from './SectionRail';
import { ScribeRecommendation, TemplateRecommendation } from './types';

interface TemplateStageProps {
  recommendation: TemplateRecommendation;
  itemState: RecommendationItemState;
  templates: TemplateOption[];
  /** True while any stage is writing to the chart. */
  locked: boolean;
  onEdit: (patch: Partial<ScribeRecommendation>) => void;
  /** Resolves once the apply has finished, successfully or not. */
  onApply: (sectionActions: TemplateSectionActions, options?: TemplatePreviewApplyOptions) => Promise<void>;
}

const testIds = dataTestIds.scribeRecommendations;

/**
 * Stage one. A template fills whole sections at once, so it goes in before the individual
 * observations land on top of it — which is why it gets its own step and its own button rather
 * than a checkbox in the list below.
 */
export const TemplateStage: FC<TemplateStageProps> = ({
  recommendation,
  itemState,
  templates,
  locked,
  onEdit,
  onApply,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // One editor is open at a time across the whole panel, and this stage is one of the places it
  // can be open in; opening it here closes — and saves — whichever row had it.
  const isEditing = useScribeRecommendationsStore((state) => state.editingId === recommendation.id);
  const setEditingId = useScribeRecommendationsStore((state) => state.setEditingId);
  const isHighlighted = useScribeRecommendationsStore((state) => state.hoveredItemId === recommendation.id);
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);
  const { detail } = describeRecommendation(recommendation);

  const isApplied = itemState.status === 'applied';
  const isApplying = itemState.status === 'applying';

  const templateOption = templates.find(
    (t) => t.label.toLowerCase() === recommendation.templateName.trim().toLowerCase()
  );
  const templateMissing = templates.length > 0 && !templateOption;
  const warning =
    isApplied || !templateMissing
      ? undefined
      : 'This template isn’t available in this environment. Choose another one.';
  const provenance = { warning, note: detail, evidence: recommendation.evidence };
  const canStartEditing = !isApplied && !isApplying && !locked && !isEditing;

  const stage = (
    <Paper
      ref={stageRef}
      variant="outlined"
      className={ROW_CLASS}
      data-testid={testIds.row(recommendation.id)}
      onMouseEnter={() => setHoveredItemId(recommendation.id)}
      onMouseLeave={() => setHoveredItemId(undefined)}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        backgroundColor: isHighlighted ? AI_SURFACE : undefined,
      }}
    >
      <SectionRail section="template" />

      {/* The click lands here rather than on the Paper so the rail keeps its own job, and so the
          preview dialog — a sibling, but a React child — can't start an edit behind itself. */}
      <Box
        onClick={canStartEditing ? () => startEditingUnlessAnotherIsOpen(recommendation.id) : undefined}
        sx={{ flex: 1, minWidth: 0, p: 1, cursor: canStartEditing ? 'pointer' : undefined }}
      >
        {isEditing ? (
          <RecommendationEditor
            recommendation={recommendation}
            templates={templates}
            rowRef={stageRef}
            // Closing is saving here too: whichever way the provider leaves the picker.
            onCommit={(patch) => {
              if (patch) onEdit(patch);
              if (useScribeRecommendationsStore.getState().editingId === recommendation.id) setEditingId(undefined);
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isApplied ? (
                // A settled green tick, the same one the rows below turn into once they land.
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, color: 'success.main' }}
                  data-testid={testIds.rowStatus(recommendation.id)}
                >
                  <Checkbox
                    size="small"
                    checked
                    disabled
                    color="success"
                    inputProps={{ 'aria-label': `${recommendation.templateName} applied` }}
                    data-testid={testIds.rowCheckbox(recommendation.id)}
                    sx={{ p: 0.5, '&.Mui-disabled.Mui-checked': { color: 'success.main', opacity: 0.55 } }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {`${recommendation.templateName} applied`}
                  </Typography>
                </Box>
              ) : (
                <RoundedButton
                  variant="contained"
                  size="small"
                  onClick={(event) => {
                    // Applying the template is not editing which template it is.
                    event.stopPropagation();
                    setIsPreviewOpen(true);
                  }}
                  loading={isApplying}
                  disabled={locked || templateMissing}
                  data-testid={testIds.templateApplyButton}
                  // The name belongs in the button: there is one thing to do here, and this says
                  // exactly what it will do. It hugs its label, and a long template name wraps
                  // inside it rather than overflowing the panel.
                  sx={{ ...roundedButtonSx, whiteSpace: 'normal' }}
                >
                  {`${itemState.status === 'error' ? 'Try again' : 'Apply template'}: ${recommendation.templateName}`}
                </RoundedButton>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, ml: 'auto' }}>
                {/* The caution has to be readable without hovering; its sentence is in the hover. */}
                {warning && (
                  <WarningAmberOutlinedIcon
                    role="img"
                    aria-hidden={false}
                    aria-label={warning}
                    sx={{ fontSize: scaled(16), color: 'warning.main' }}
                  />
                )}
                {canStartEditing && (
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditingUnlessAnotherIsOpen(recommendation.id);
                    }}
                    aria-label={`Choose a different template than ${recommendation.templateName}`}
                    data-testid={testIds.rowEditButton(recommendation.id)}
                    sx={{ p: 0.5, ...HOVER_ONLY }}
                  >
                    <EditOutlinedIcon sx={{ fontSize: scaled(18) }} />
                  </IconButton>
                )}
              </Box>
            </Box>

            {itemState.status === 'error' && (
              <Typography variant="caption" color="error">
                {itemState.error ?? 'Could not apply the template.'}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* The same dialog the HPI screen uses, so the provider picks which parts of the template
          to take here rather than getting all of it or none of it. */}
      <TemplatePreviewDialog
        open={isPreviewOpen}
        templateId={templateOption?.id ?? null}
        templateName={recommendation.templateName}
        isApplying={isApplying}
        onCancel={() => setIsPreviewOpen(false)}
        onApply={(sectionActions, options) => {
          void onApply(sectionActions, options).finally(() => setIsPreviewOpen(false));
        }}
      />
    </Paper>
  );

  // Same as the rows below: the "why" is the hover, so the stage carries no control for it — and
  // the empty title both closes the hover on the way into the editor and keeps the wrapper put,
  // so the edit doesn't remount the stage's DOM under whatever is holding it.
  const title = !hasProvenance(provenance) || isEditing ? '' : <ProvenanceContent {...provenance} />;
  return (
    <Tooltip title={title} placement="left" enterDelay={300}>
      {stage}
    </Tooltip>
  );
};

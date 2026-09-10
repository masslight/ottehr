import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Collapse, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sidebarMenuIcons } from '../sidebarMenuIcons';
import { TemplateOption } from '../templates/useListTemplates';
import { hasProvenance, ProvenanceContent, ProvenancePanel, ProvenanceToggle } from './Provenance';
import { RecommendationEditor } from './RecommendationRow';
import { RecommendationItemState } from './scribeRecommendations.store';
import { describeRecommendation } from './scribeSections';
import { ScribeRecommendation, TemplateRecommendation } from './types';

interface TemplateStageProps {
  recommendation: TemplateRecommendation;
  itemState: RecommendationItemState;
  templates: TemplateOption[];
  /** True while any stage is writing to the chart. */
  locked: boolean;
  onEdit: (patch: Partial<ScribeRecommendation>) => void;
  onApply: () => void;
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
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { detail } = describeRecommendation(recommendation);

  const isApplied = itemState.status === 'applied';
  const isApplying = itemState.status === 'applying';

  const templateMissing =
    templates.length > 0 &&
    !templates.some((t) => t.label.toLowerCase() === recommendation.templateName.trim().toLowerCase());
  const warning =
    isApplied || !templateMissing
      ? undefined
      : 'This template isn’t available in this environment. Choose another one.';
  const provenance = { warning, note: detail, evidence: recommendation.evidence };

  return (
    <Paper
      variant="outlined"
      data-testid={testIds.row(recommendation.id)}
      sx={{ p: 1.5, backgroundColor: isApplied ? undefined : theme.palette.action.hover }}
    >
      {isEditing ? (
        <RecommendationEditor
          recommendation={recommendation}
          templates={templates}
          onSave={(patch) => {
            onEdit(patch);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                color: theme.palette.primary.dark,
                mt: '2px',
                '& svg': { width: 18, height: 18 },
              }}
            >
              {sidebarMenuIcons['History']}
            </Box>
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {recommendation.templateName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
              {hasProvenance(provenance) && (
                <ProvenanceToggle
                  content={<ProvenanceContent {...provenance} />}
                  isOpen={isDetailOpen}
                  onToggle={() => setIsDetailOpen((open) => !open)}
                  subject={recommendation.templateName}
                  hasWarning={Boolean(warning)}
                  dataTestId={testIds.rowDetailButton(recommendation.id)}
                />
              )}
              {!isApplied && !isApplying && !locked && (
                <Tooltip title="Choose a different template">
                  <IconButton
                    size="small"
                    onClick={() => setIsEditing(true)}
                    aria-label={`Choose a different template than ${recommendation.templateName}`}
                    data-testid={testIds.rowEditButton(recommendation.id)}
                    sx={{ p: 0.5 }}
                  >
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          <Collapse in={isDetailOpen} unmountOnExit>
            <ProvenancePanel hasWarning={Boolean(warning)} dataTestId={testIds.rowDetail(recommendation.id)}>
              <ProvenanceContent {...provenance} />
            </ProvenancePanel>
          </Collapse>

          {itemState.status === 'error' && (
            <Typography variant="caption" color="error">
              {itemState.error ?? 'Could not apply the template.'}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isApplied ? (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}
                data-testid={testIds.rowStatus(recommendation.id)}
              >
                <CheckCircleIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">Template applied</Typography>
              </Box>
            ) : (
              <RoundedButton
                variant="contained"
                size="small"
                onClick={onApply}
                loading={isApplying}
                disabled={locked}
                data-testid={testIds.templateApplyButton}
              >
                {itemState.status === 'error' ? 'Try again' : 'Apply template'}
              </RoundedButton>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

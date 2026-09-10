import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Chip, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import { FC, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sidebarMenuIcons } from '../sidebarMenuIcons';
import { TemplateOption } from '../templates/useListTemplates';
import { RecommendationRow } from './RecommendationRow';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { getVisitBasePath, SCRIBE_SECTION_ORDER, SCRIBE_SECTIONS } from './scribeSections';
import { ScribeRecommendation, ScribeSectionKey } from './types';

interface RecommendationsListProps {
  /** The observations to group. The template is its own stage, so it never appears here. */
  recommendations: ScribeRecommendation[];
  templates: TemplateOption[];
  onRetry: () => void;
}

const testIds = dataTestIds.scribeRecommendations;

/** Stage two: the individual observations, grouped by the chart section each one writes into. */
export const RecommendationsList: FC<RecommendationsListProps> = ({ recommendations, templates, onRetry }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setSelected = useScribeRecommendationsStore((state) => state.setSelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);

  const groups = useMemo(
    () =>
      SCRIBE_SECTION_ORDER.map((section) => ({
        section,
        items: recommendations.filter((rec) => rec.section === section),
      })).filter((group) => group.items.length > 0),
    [recommendations]
  );

  const goToSection = (section: ScribeSectionKey): void => {
    const base = getVisitBasePath(pathname);
    if (base) navigate(`${base}/${SCRIBE_SECTIONS[section].route}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {groups.map(({ section, items }) => {
        const meta = SCRIBE_SECTIONS[section];
        const pending = items.filter((rec) => itemState[rec.id]?.status !== 'applied');
        const selectedCount = pending.filter((rec) => itemState[rec.id]?.selected).length;
        const appliedCount = items.length - pending.length;

        return (
          <Paper key={section} variant="outlined" data-testid={testIds.group(section)}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                pl: 1.5,
                pr: 1,
                py: 0.5,
                backgroundColor: theme.palette.action.hover,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.primary.dark }}>
                {sidebarMenuIcons[meta.iconKey]}
              </Box>
              <Typography variant="subtitle2" sx={{ flex: 1, color: theme.palette.primary.dark }}>
                {meta.label}
              </Typography>
              {appliedCount > 0 && (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={appliedCount === items.length ? 'Applied' : `${appliedCount} applied`}
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                {pending.length > 0 ? `${selectedCount}/${pending.length}` : ''}
              </Typography>
              <Tooltip title={`Open ${meta.label} in the note`}>
                <IconButton
                  size="small"
                  onClick={() => goToSection(section)}
                  aria-label={`Open ${meta.label}`}
                  data-testid={testIds.goToSectionButton(section)}
                  sx={{ p: 0.5 }}
                >
                  <ArrowForwardIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box>
              {items.map((rec) => (
                <RecommendationRow
                  key={rec.id}
                  recommendation={rec}
                  itemState={itemState[rec.id] ?? { selected: true, status: 'idle' }}
                  locked={isApplying}
                  templates={templates}
                  onSelectedChange={(selected) => setSelected(rec.id, selected)}
                  onEdit={(patch: Partial<ScribeRecommendation>) => updateRecommendation(rec.id, patch)}
                  onRetry={() => {
                    setSelected(rec.id, true);
                    onRetry();
                  }}
                />
              ))}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

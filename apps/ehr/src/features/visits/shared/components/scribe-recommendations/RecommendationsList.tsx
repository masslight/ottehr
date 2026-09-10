import { alpha, Box, ButtonBase, Paper, Tooltip, Typography } from '@mui/material';
import { FC, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
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

/** Wide enough for the rotated label to stay legible, narrow enough not to squeeze the rows. */
const RAIL_WIDTH = 26;
const RAIL_BAR_WIDTH = 3;

/**
 * Stage two: the individual observations, grouped by the chart section each one writes into.
 *
 * The section name runs down a coloured rail on the left rather than sitting in a header row of
 * its own — with six or seven groups on screen, those headers were costing more vertical space
 * than the recommendations they introduced. The rail doubles as the link into that part of the
 * note.
 */
export const RecommendationsList: FC<RecommendationsListProps> = ({ recommendations, templates, onRetry }) => {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {groups.map(({ section, items }) => {
        const meta = SCRIBE_SECTIONS[section];

        return (
          <Paper
            key={section}
            variant="outlined"
            data-testid={testIds.group(section)}
            sx={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}
          >
            <Tooltip title={`Open ${meta.label} in the note`} placement="left">
              <ButtonBase
                onClick={() => goToSection(section)}
                aria-label={`Open ${meta.label} in the note`}
                data-testid={testIds.goToSectionButton(section)}
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'stretch',
                  backgroundColor: alpha(meta.accent, 0.07),
                  '&:hover, &:focus-visible': { backgroundColor: alpha(meta.accent, 0.18) },
                }}
              >
                <Box sx={{ width: RAIL_BAR_WIDTH, backgroundColor: meta.accent }} />
                <Box
                  sx={{
                    width: RAIL_WIDTH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 0.25,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      // Rotated so the label reads bottom-to-top down the rail.
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      whiteSpace: 'nowrap',
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      color: meta.accent,
                    }}
                  >
                    {meta.shortLabel}
                  </Typography>
                </Box>
              </ButtonBase>
            </Tooltip>

            <Box sx={{ flex: 1, minWidth: 0 }}>
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

import { Box, Paper } from '@mui/material';
import { FC, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { TemplateOption } from '../templates/useListTemplates';
import { RecommendationRow } from './RecommendationRow';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { SCRIBE_SECTION_ORDER, sortForReview } from './scribeSections';
import { SectionRail } from './SectionRail';
import { ScribeRecommendation } from './types';

interface RecommendationsListProps {
  /** The observations to group. The template is its own stage, so it never appears here. */
  recommendations: ScribeRecommendation[];
  templates: TemplateOption[];
  onRetry: () => void;
}

const testIds = dataTestIds.scribeRecommendations;

/**
 * Stage two: the individual observations, grouped by the chart section each one writes into.
 *
 * The section name runs down a coloured rail on the left rather than sitting in a header row of
 * its own — with six or seven groups on screen, those headers were costing more vertical space
 * than the recommendations they introduced. The rail doubles as the link into that part of the
 * note.
 */
export const RecommendationsList: FC<RecommendationsListProps> = ({ recommendations, templates, onRetry }) => {
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const chartedIds = useScribeRecommendationsStore((state) => state.chartedIds);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setSelected = useScribeRecommendationsStore((state) => state.setSelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);

  // The review order keys on the ROS finding, which the provider toggles; sorting on every render moved
  // the toggled row and put the next click on a different one. The order is fixed when the set of
  // recommendations changes and reused while their contents are edited.
  const idKey = recommendations.map((rec) => rec.id).join('|');
  const rank = useMemo(
    () => new Map(sortForReview(recommendations).map((rec, index) => [rec.id, index])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids, not the edited contents
    [idKey]
  );
  const groups = useMemo(
    () =>
      SCRIBE_SECTION_ORDER.map((section) => ({
        section,
        items: recommendations
          .filter((rec) => rec.section === section)
          .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)),
      })).filter((group) => group.items.length > 0),
    [recommendations, rank]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {groups.map(({ section, items }) => (
        <Paper
          key={section}
          variant="outlined"
          data-testid={testIds.group(section)}
          sx={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}
        >
          <SectionRail section={section} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {items.map((rec) => (
              <RecommendationRow
                key={rec.id}
                recommendation={rec}
                itemState={itemState[rec.id] ?? { selected: true, status: 'idle' }}
                locked={isApplying}
                charted={chartedIds.includes(rec.id)}
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
      ))}
    </Box>
  );
};

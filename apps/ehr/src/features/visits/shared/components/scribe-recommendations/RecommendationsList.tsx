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
  /** The chart is signed and locked: rows can't be ticked, edited or retried. */
  locked: boolean;
  onRetry: () => void;
}

const testIds = dataTestIds.scribeRecommendations;

/**
 * Observations grouped by the chart section each writes into. A coloured rail names each section and links
 * to that part of the note.
 */
export const RecommendationsList: FC<RecommendationsListProps> = ({ recommendations, templates, locked, onRetry }) => {
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const chartedIds = useScribeRecommendationsStore((state) => state.chartedIds);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setSelected = useScribeRecommendationsStore((state) => state.setSelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);

  // The order is fixed per set of ids: it keys on the ROS finding, so re-sorting on edit would move the
  // toggled row out from under the next click.
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
                locked={isApplying || locked}
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

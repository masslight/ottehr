import { Box, Stack, Typography } from '@mui/material';
import { ComponentProps, FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { ExamReviewGroup } from '../review-tab/components/ExamReviewGroup';
import { findAiAddedFor, useAiAddedRecommendations } from '../scribe-recommendations/aiAddedMarks';

export const RosReviewContainer: FC = () => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const state = useRosObservationsStore();
  const aiAdded = useAiAddedRecommendations();

  const sections: { key: string; label: string; items: ComponentProps<typeof ExamReviewGroup>['items'] }[] = [];

  // gather up / organize the information for stored ros observations to be displayed in inline summaries
  for (const [systemKey, system] of Object.entries(InPersonRosConfig)) {
    const items: ComponentProps<typeof ExamReviewGroup>['items'] = [];

    for (const [baseKey, item] of Object.entries(system.items)) {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);

      const denies = state[deniesKey];
      const reports = state[reportsKey];

      if (denies?.value) {
        items.push({
          field: deniesKey,
          label: item.label,
          abnormal: false,
          aiAdded: findAiAddedFor(aiAdded, { kind: 'ros', fieldKey: deniesKey }),
        });
      }

      if (reports?.value) {
        items.push({
          field: reportsKey,
          label: item.label,
          abnormal: true,
          aiAdded: findAiAddedFor(aiAdded, { kind: 'ros', fieldKey: reportsKey }),
        });
      }
    }

    if (items.length > 0) {
      sections.push({
        key: systemKey,
        label: system.label,
        items,
      });
    }
  }

  return (
    <Stack spacing={1} data-testid={dataTestIds.progressNotePage.rosReviewContainer}>
      {!titleInCardHeader && <SectionHeading>Review of Systems</SectionHeading>}
      {sections.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map((section) => (
            <ExamReviewGroup key={section.key} label={section.label} items={section.items} />
          ))}
        </Box>
      ) : (
        <Box>
          <Typography color="text.secondary">No review of systems</Typography>
        </Box>
      )}
    </Stack>
  );
};

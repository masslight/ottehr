import { Box, Typography } from '@mui/material';
import type { ExamItemConfig } from 'config-types';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  collectKnownExamFields,
  extractObservationsFromExamComponents,
} from 'utils/lib/config-helpers/exam-observations';
import { useExamObservationsStore } from '../../../stores/appointment/exam-observations.store';
import { ExamReviewGroup } from './ExamReviewGroup';

type ExaminationContainerProps = {
  examConfig: ExamItemConfig;
};

export const ExaminationContainer: FC<ExaminationContainerProps> = (props) => {
  const { examConfig } = props;

  const examObservations = useExamObservationsStore();

  const knownFields = collectKnownExamFields(examConfig);

  const getSectionObservations = (
    sectionKey: string
  ): {
    normalItems: { field: string; label: string; abnormal: boolean }[];
    abnormalItems: { field: string; label: string; abnormal: boolean }[];
  } => {
    const section = examConfig[sectionKey];
    if (!section) return { normalItems: [], abnormalItems: [] };

    const normalItems = extractObservationsFromExamComponents(section.components.normal, 'normal', examObservations);
    const abnormalItems = extractObservationsFromExamComponents(
      section.components.abnormal,
      'abnormal',
      examObservations
    );

    return { normalItems, abnormalItems };
  };

  // Find unmatched observations that have value=true but aren't in the config
  const unmatchedItems = Object.values(examObservations)
    .filter((obs) => obs.value === true && !knownFields.has(obs.field))
    .map((obs) => ({
      field: obs.field,
      label: obs.label || obs.field,
      abnormal: true,
    }));

  const groups = Object.entries(examConfig)
    .map(([sectionKey, section]) => {
      const { normalItems, abnormalItems } = getSectionObservations(sectionKey);
      const items = [...normalItems, ...abnormalItems];
      const comment = Object.keys(section.components.comment)
        .map((key) => examObservations[key]?.note)
        .filter((note) => note !== undefined)
        .join(' ');

      return { sectionKey, label: section.label, items, comment };
    })
    .filter((group) => group.items.length > 0 || group.comment);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer}
    >
      {groups.length === 0 && unmatchedItems.length === 0 && (
        <Typography color="text.secondary">No exam findings</Typography>
      )}
      {groups.map((group) => (
        <ExamReviewGroup key={group.sectionKey} label={group.label} items={group.items} comment={group.comment} />
      ))}
      {unmatchedItems.length > 0 && <ExamReviewGroup label="Other findings" items={unmatchedItems} />}
    </Box>
  );
};
